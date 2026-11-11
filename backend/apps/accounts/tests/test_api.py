from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.test import override_settings
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User

STUDENT_PAYLOAD = {
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


def verification_payload(user: User) -> dict:
    return {
        "uid": urlsafe_base64_encode(force_bytes(user.pk)),
        "token": default_token_generator.make_token(user),
    }


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class RegistrationTests(APITestCase):
    def setUp(self):
        mail.outbox = []

    def test_register_creates_visitor_and_sends_verification_email(self):
        response = self.client.post("/api/v1/auth/register/", STUDENT_PAYLOAD, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(email="2024-123456@rtu.edu.ph")
        self.assertEqual(user.role, User.Role.VISITOR)
        self.assertFalse(user.is_verified)
        self.assertEqual(len(mail.outbox), 1)
        # The sign-up screens use a 6-digit code, not a link.
        self.assertRegex(mail.outbox[0].body, r"code is:\s*\d{6}")
        self.assertNotIn("verify-email", mail.outbox[0].body)

    def test_register_rejects_non_rtu_email(self):
        payload = STUDENT_PAYLOAD | {"email": "juan@gmail.com"}

        response = self.client.post("/api/v1/auth/register/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)
        self.assertFalse(User.objects.exists())

    def test_register_rejects_student_without_student_number_form(self):
        payload = STUDENT_PAYLOAD | {"email": "juan.delacruz@rtu.edu.ph"}

        response = self.client.post("/api/v1/auth/register/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)

    def test_register_requires_privacy_consent(self):
        payload = STUDENT_PAYLOAD | {"privacy_consent": False}

        response = self.client.post("/api/v1/auth/register/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("privacy_consent", response.data)

    def test_register_rejects_duplicate_email(self):
        self.client.post("/api/v1/auth/register/", STUDENT_PAYLOAD, format="json")

        response = self.client.post("/api/v1/auth/register/", STUDENT_PAYLOAD, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)

    def test_register_rejects_mismatched_passwords(self):
        payload = STUDENT_PAYLOAD | {"password_confirm": "DifferentPass123!"}

        response = self.client.post("/api/v1/auth/register/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password_confirm", response.data)


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class VerificationAndLoginTests(APITestCase):
    def setUp(self):
        mail.outbox = []
        self.user = User.objects.create_user(
            email=STUDENT_PAYLOAD["email"],
            display_name=STUDENT_PAYLOAD["display_name"],
            password=STUDENT_PAYLOAD["password"],
            member_type=User.MemberType.STUDENT,
            college=STUDENT_PAYLOAD["college"],
            year_level=STUDENT_PAYLOAD["year_level"],
        )

    def test_login_is_blocked_before_email_verification(self):
        response = self.client.post(
            "/api/v1/auth/login/",
            {"email": self.user.email, "password": "SecurePass123!"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data["code"], "email_not_verified")

    def test_verify_email_activates_account_and_returns_token(self):
        response = self.client.post(
            "/api/v1/auth/verify-email/",
            verification_payload(self.user),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("token", response.data)

        self.user.refresh_from_db()
        self.assertTrue(self.user.is_verified)
        self.assertEqual(self.user.role, User.Role.USER)

    def test_verify_email_rejects_bad_token(self):
        payload = verification_payload(self.user) | {"token": "not-a-real-token"}

        response = self.client.post("/api/v1/auth/verify-email/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_verified_user_can_log_in(self):
        self.user.verify()

        response = self.client.post(
            "/api/v1/auth/login/",
            {"email": self.user.email, "password": "SecurePass123!"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("token", response.data)
        self.assertEqual(response.data["user"]["email"], self.user.email)

    def test_suspended_user_cannot_log_in(self):
        self.user.verify()
        self.user.status = User.Status.SUSPENDED
        self.user.save(update_fields=["status"])

        response = self.client.post(
            "/api/v1/auth/login/",
            {"email": self.user.email, "password": "SecurePass123!"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data["code"], "account_suspended")

    def test_wrong_password_is_rejected(self):
        self.user.verify()

        response = self.client.post(
            "/api/v1/auth/login/",
            {"email": self.user.email, "password": "WrongPass123!"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_resend_verification_sends_email(self):
        response = self.client.post(
            "/api/v1/auth/resend-verification/",
            {"email": self.user.email},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)


class ProfileTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="2024-123456@rtu.edu.ph",
            display_name="Juan Dela Cruz",
            password="SecurePass123!",
            member_type=User.MemberType.STUDENT,
            college="College of ICT",
            year_level=2,
        )
        self.user.verify()
        self.client.force_authenticate(self.user)

    def test_me_requires_authentication(self):
        self.client.force_authenticate(None)

        response = self.client.get("/api/v1/auth/me/")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_returns_profile(self):
        response = self.client.get("/api/v1/auth/me/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["email"], self.user.email)
        self.assertEqual(response.data["student_number"], "2024-123456")

    def test_profile_can_be_updated(self):
        response = self.client.patch(
            "/api/v1/auth/me/",
            {"display_name": "Juan P. Dela Cruz", "year_level": 3},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.display_name, "Juan P. Dela Cruz")
        self.assertEqual(self.user.year_level, 3)

    def test_email_and_role_are_not_editable(self):
        response = self.client.patch(
            "/api/v1/auth/me/",
            {"email": "other@rtu.edu.ph", "role": "administrator"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, "2024-123456@rtu.edu.ph")
        self.assertEqual(self.user.role, User.Role.USER)

    def test_logout_deletes_token(self):
        response = self.client.post(
            "/api/v1/auth/login/",
            {"email": self.user.email, "password": "SecurePass123!"},
            format="json",
        )
        token = response.data["token"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token}")

        response = self.client.post("/api/v1/auth/logout/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.client.credentials()
