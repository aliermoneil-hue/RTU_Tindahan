"""Tests for the 6-digit sign-up code (AV-03, code-based flow)."""

import re
from datetime import timedelta

from django.contrib.auth.hashers import check_password
from django.core import mail
from django.core.cache import cache
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User, VerificationCode

STUDENT = {
    "email": "2024-123456@rtu.edu.ph",
    "display_name": "Juan Dela Cruz",
    "password": "SecurePass123!",
    "password_confirm": "SecurePass123!",
    "member_type": "student",
    "college": "College of Information and Communications Technology",
    "year_level": 2,
    "contact_number": "09171234567",
    "privacy_consent": True,
}

REGISTER = "/api/v1/auth/register/"
VERIFY_CODE = "/api/v1/auth/verify-code/"
RESEND_CODE = "/api/v1/auth/resend-code/"


def code_from_last_email() -> str:
    """Pull the code out of the message the way a human would read it."""
    match = re.search(r"code is:\s*(\d{6})", mail.outbox[-1].body)
    assert match, f"no 6-digit code in the email body:\n{mail.outbox[-1].body}"
    return match.group(1)


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class CodeFlowTests(APITestCase):
    def setUp(self):
        mail.outbox = []
        # The throttle tables and the resend cooldown share the default cache,
        # so start every test from a clean one.
        cache.clear()

    def register(self, **overrides):
        payload = STUDENT | overrides
        return self.client.post(REGISTER, payload, format="json")

    def verify(self, email, code):
        return self.client.post(
            VERIFY_CODE, {"email": email, "code": code}, format="json"
        )

    # -- issuing -----------------------------------------------------------

    def test_register_emails_a_six_digit_code_and_nothing_else(self):
        response = self.register()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("verification code", mail.outbox[0].subject.lower())
        code_from_last_email()  # asserts a 6-digit code is present
        self.assertNotIn("verify-email", mail.outbox[0].body)

    def test_only_a_hash_of_the_code_is_stored(self):
        self.register()
        code = code_from_last_email()

        record = VerificationCode.objects.get()
        # Assert the property, not the hasher's prefix: the suite runs on a fast
        # hasher and production does not, and either way the code must be
        # unreadable in the row while still being checkable against it.
        self.assertNotEqual(record.code_hash, code)
        self.assertNotIn(code, record.code_hash)
        self.assertTrue(check_password(code, record.code_hash))
        self.assertEqual(record.attempts, 0)

    def test_the_email_carries_the_same_code_that_was_stored(self):
        self.register()
        code = code_from_last_email()

        response = self.verify(STUDENT["email"], code)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    # -- verifying ---------------------------------------------------------

    def test_correct_code_activates_the_account_and_signs_in(self):
        self.register()
        code = code_from_last_email()

        response = self.verify(STUDENT["email"], code)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("token", response.data)
        self.assertEqual(response.data["user"]["role"], User.Role.USER)
        user = User.objects.get(email=STUDENT["email"])
        self.assertTrue(user.is_verified)
        self.assertFalse(VerificationCode.objects.exists())

    def test_a_used_code_cannot_be_replayed(self):
        self.register()
        code = code_from_last_email()
        self.verify(STUDENT["email"], code)

        again = self.verify(STUDENT["email"], code)

        # No second sign-in without the password.
        self.assertEqual(again.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(again.data["code"], "already_verified")
        self.assertNotIn("token", again.data)

    def test_wrong_code_says_how_many_tries_are_left(self):
        self.register()
        code = code_from_last_email()
        wrong = f"{(int(code) + 1) % 1000000:06d}"

        response = self.verify(STUDENT["email"], wrong)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("4 tries left", response.data["detail"])
        self.assertEqual(VerificationCode.objects.get().attempts, 1)

    def test_five_wrong_tries_burn_the_code(self):
        self.register()
        code = code_from_last_email()
        wrong = f"{(int(code) + 1) % 1000000:06d}"

        for _ in range(5):
            self.verify(STUDENT["email"], wrong)

        self.assertFalse(VerificationCode.objects.exists())
        # Even the real code is useless now.
        response = self.verify(STUDENT["email"], code)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Ask for a new code", response.data["detail"])

    def test_expired_code_is_refused(self):
        self.register()
        code = code_from_last_email()
        record = VerificationCode.objects.get()
        record.expires_at = timezone.now() - timedelta(seconds=1)
        record.save(update_fields=["expires_at"])

        response = self.verify(STUDENT["email"], code)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("expired", response.data["detail"])

    def test_unknown_email_gets_the_same_answer_as_a_wrong_code(self):
        response = self.verify("2024-999999@rtu.edu.ph", "123456")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "That code is not right.")

    def test_a_code_only_works_for_its_own_account(self):
        self.register()
        code = code_from_last_email()
        other = self.register(email="2024-111111@rtu.edu.ph")
        self.assertEqual(other.status_code, status.HTTP_201_CREATED)

        response = self.verify("2024-111111@rtu.edu.ph", code)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.get(email="2024-111111@rtu.edu.ph").is_verified)

    def test_a_suspended_account_cannot_verify(self):
        self.register()
        code = code_from_last_email()
        User.objects.filter(email=STUDENT["email"]).update(status=User.Status.SUSPENDED)

        response = self.verify(STUDENT["email"], code)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data["code"], "account_suspended")

    def test_malformed_code_is_a_field_error(self):
        self.register()

        response = self.verify(STUDENT["email"], "12ab56")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("code", response.data)

    # -- resending ---------------------------------------------------------

    def test_resending_immediately_is_refused_by_the_cooldown(self):
        self.register()

        response = self.client.post(
            RESEND_CODE, {"email": STUDENT["email"]}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(response.data["code"], "code_cooldown")

    def test_resending_after_the_cooldown_sends_a_new_code(self):
        self.register()
        first = code_from_last_email()
        cache.clear()

        response = self.client.post(
            RESEND_CODE, {"email": STUDENT["email"]}, format="json"
        )
        second = code_from_last_email()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 2)
        self.assertNotEqual(first, second)

        # The new code is the one that works.
        verified = self.verify(STUDENT["email"], second)
        self.assertEqual(verified.status_code, status.HTTP_200_OK)
        self.assertTrue(User.objects.get(email=STUDENT["email"]).is_verified)

    def test_unknown_email_does_not_reveal_itself_on_resend(self):
        response = self.client.post(
            RESEND_CODE, {"email": "2024-999999@rtu.edu.ph"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("If that RTU email", response.data["detail"])
        self.assertEqual(len(mail.outbox), 0)


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class LoginAfterVerificationTests(APITestCase):
    def setUp(self):
        mail.outbox = []
        cache.clear()

    def test_the_account_can_then_sign_in_with_its_password(self):
        self.client.post(REGISTER, STUDENT, format="json")
        code = code_from_last_email()
        self.client.post(
            VERIFY_CODE, {"email": STUDENT["email"], "code": code}, format="json"
        )

        response = self.client.post(
            "/api/v1/auth/login/",
            {"email": STUDENT["email"], "password": STUDENT["password"]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("token", response.data)

    def test_an_unverified_account_is_told_to_verify_not_that_it_is_wrong(self):
        self.client.post(REGISTER, STUDENT, format="json")

        response = self.client.post(
            "/api/v1/auth/login/",
            {"email": STUDENT["email"], "password": STUDENT["password"]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data["code"], "email_not_verified")
