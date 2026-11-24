"""Tests for login lockout / failed-attempt protection (SE-05).

Time is advanced by patching django.utils.timezone.now in lockout.py instead of
sleeping, so the tests run instantly.
"""

from unittest.mock import patch

from django.core.cache import cache
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.lockout import current_lock, record_failure, reset
from apps.accounts.models import User

LOGIN = "/api/v1/auth/login/"
LOGIN_STATUS = "/api/v1/auth/login-status/"

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


def make_user(email=STUDENT_PAYLOAD["email"], password=STUDENT_PAYLOAD["password"], verified=True):
    user = User.objects.create_user(
        email=email,
        display_name=STUDENT_PAYLOAD["display_name"],
        password=password,
        member_type=User.MemberType.STUDENT,
        college=STUDENT_PAYLOAD["college"],
        year_level=STUDENT_PAYLOAD["year_level"],
    )
    if verified:
        user.verify()
    return user


def failed_login(client, email, password="WrongPass123!"):
    return client.post(LOGIN, {"email": email, "password": password}, format="json")


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    REST_FRAMEWORK={
        "DEFAULT_AUTHENTICATION_CLASSES": [
            "rest_framework.authentication.TokenAuthentication",
            "rest_framework.authentication.SessionAuthentication",
        ],
        "DEFAULT_PERMISSION_CLASSES": [
            "rest_framework.permissions.IsAuthenticated",
        ],
        "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
        "PAGE_SIZE": 20,
        "DEFAULT_RENDERER_CLASSES": [
            "rest_framework.renderers.JSONRenderer",
        ],
        "DEFAULT_THROTTLE_RATES": {
            "login": "1000/min",
            "register": "100/minute",
            "verify": "20/hour",
            "login-status": "60/min",
        },
    },
)
class LoginLockoutTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = make_user()
        # Disable throttling for these tests so multiple rapid login attempts
        # are not rejected by the IP-level safety net before the per-account
        # rule is exercised.
        from rest_framework.throttling import ScopedRateThrottle
        self._orig_allow_request = ScopedRateThrottle.allow_request
        ScopedRateThrottle.allow_request = lambda self, request, view: True

    def tearDown(self):
        from rest_framework.throttling import ScopedRateThrottle
        ScopedRateThrottle.allow_request = self._orig_allow_request

    # -- unit tests for lockout.py ---------------------------------------

    def test_current_lock_returns_none_when_no_attempts(self):
        self.assertIsNone(current_lock(self.user.email))

    def test_record_failure_counts_and_reports_attempts_left(self):
        result = record_failure(self.user.email)
        self.assertFalse(result.locked)
        self.assertEqual(result.attempts_left, 4)
        self.assertEqual(result.next_penalty, "cooldown")

    def test_fifth_failure_creates_cooldown(self):
        for _ in range(4):
            record_failure(self.user.email)
        result = record_failure(self.user.email)
        self.assertTrue(result.locked)
        self.assertEqual(result.kind, "cooldown")
        self.assertEqual(result.retry_after, 60)

    def test_sixth_failure_after_cooldown_shows_one_attempt_left(self):
        # Reach cooldown (5 failures)
        for _ in range(5):
            record_failure(self.user.email)
        # Move time past the 60-second cooldown
        future = timezone.now() + timezone.timedelta(seconds=61)
        with patch("apps.accounts.lockout.timezone.now", return_value=future):
            # current_lock should see the expired cooldown and KEEP the count at 5
            lock = current_lock(self.user.email)
            self.assertIsNone(lock)
            # 6th failure: 1 attempt left before restriction
            result = record_failure(self.user.email)
            self.assertFalse(result.locked)
            self.assertEqual(result.attempts_left, 1)
            self.assertEqual(result.next_penalty, "restriction")

    def test_seventh_failure_creates_restriction(self):
        for _ in range(6):
            record_failure(self.user.email)
        result = record_failure(self.user.email)
        self.assertTrue(result.locked)
        self.assertEqual(result.kind, "restricted")
        self.assertEqual(result.retry_after, 900)

    def test_reset_clears_the_record(self):
        for _ in range(5):
            record_failure(self.user.email)
        self.assertIsNotNone(current_lock(self.user.email))
        reset(self.user.email)
        self.assertIsNone(current_lock(self.user.email))

    def test_stale_count_older_than_24h_resets(self):
        old = timezone.now() - timezone.timedelta(hours=25)
        with patch("apps.accounts.lockout.timezone.now", return_value=old):
            record_failure(self.user.email)
        # Now: a fresh failure should start from 0 again (stale count cleared)
        result = record_failure(self.user.email)
        self.assertEqual(result.attempts_left, 4)

    def test_lock_on_one_email_does_not_affect_another(self):
        record_failure(self.user.email)
        other = make_user(email="2024-999999@rtu.edu.ph")
        self.assertIsNone(current_lock(other.email))

    # -- API tests -------------------------------------------------------

    def test_wrong_password_1_to_4_returns_400_with_attempts_left(self):
        for i in range(1, 5):
            response = failed_login(self.client, self.user.email)
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertEqual(response.data["detail"], "Email or password is incorrect.")
            self.assertEqual(response.data["attempts_left"], 5 - i)

    def test_fifth_failure_returns_429_cooldown(self):
        for _ in range(4):
            failed_login(self.client, self.user.email)
        response = failed_login(self.client, self.user.email)
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(response.data["code"], "login_cooldown")
        self.assertIn("retry_after", response.data)
        self.assertGreaterEqual(response.data["retry_after"], 1)
        self.assertEqual(response["Retry-After"], str(response.data["retry_after"]))

    def test_correct_password_during_cooldown_is_still_refused(self):
        for _ in range(5):
            failed_login(self.client, self.user.email)
        # Even the right password is refused while locked.
        response = self.client.post(
            LOGIN, {"email": self.user.email, "password": STUDENT_PAYLOAD["password"]}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(response.data.get("code"), "login_cooldown")

    def test_after_cooldown_sixth_failure_shows_one_attempt_left(self):
        for _ in range(5):
            failed_login(self.client, self.user.email)
        # Manually expire the cooldown: set locked_until to the past,
        # keep the failed_count at 5 (cooldown expiry keeps the count).
        from apps.accounts.models import LoginAttempt
        attempt = LoginAttempt.objects.get(email=self.user.email)
        attempt.locked_until = timezone.now() - timezone.timedelta(seconds=1)
        attempt.save(update_fields=["locked_until"])

        # Now current_lock should see the expired cooldown and keep count=5.
        self.assertIsNone(current_lock(self.user.email))
        # 6th failure: 1 attempt left before restriction
        response = failed_login(self.client, self.user.email)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["attempts_left"], 1)
        self.assertEqual(response.data["next_penalty"], "restriction")

    def test_seventh_failure_returns_429_restricted(self):
        for _ in range(5):
            failed_login(self.client, self.user.email)
        # Expire the cooldown so the 6th attempt can be recorded.
        from apps.accounts.models import LoginAttempt
        attempt = LoginAttempt.objects.get(email=self.user.email)
        attempt.locked_until = timezone.now() - timezone.timedelta(seconds=1)
        attempt.save(update_fields=["locked_until"])
        # 6th failure: 1 attempt left before restriction
        response = failed_login(self.client, self.user.email)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["attempts_left"], 1)
        # 7th failure: restriction.
        response = failed_login(self.client, self.user.email)
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(response.data.get("code"), "login_restricted")
        self.assertGreaterEqual(response.data["retry_after"], 1)

    def test_after_restriction_expires_login_works_and_count_is_zero(self):
        for _ in range(7):
            failed_login(self.client, self.user.email)
        # Manually expire the restriction: restriction expiry resets count to 0.
        from apps.accounts.models import LoginAttempt
        attempt = LoginAttempt.objects.get(email=self.user.email)
        attempt.locked_until = timezone.now() - timezone.timedelta(seconds=1)
        attempt.failed_count = 0
        attempt.save(update_fields=["locked_until", "failed_count"])

        response = self.client.post(
            LOGIN,
            {"email": self.user.email, "password": STUDENT_PAYLOAD["password"]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("token", response.data)

    def test_successful_login_resets_the_counter(self):
        for _ in range(3):
            failed_login(self.client, self.user.email)
        response = self.client.post(
            LOGIN,
            {"email": self.user.email, "password": STUDENT_PAYLOAD["password"]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # After success, the count is 0: 4 more failures = cooldown again
        for i in range(1, 5):
            response = failed_login(self.client, self.user.email)
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertEqual(response.data["attempts_left"], 5 - i)

    def test_unknown_email_behaves_exactly_like_a_real_one(self):
        response = failed_login(self.client, "2024-999999@rtu.edu.ph")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "Email or password is incorrect.")
        self.assertEqual(response.data["attempts_left"], 4)

    def test_lock_on_one_email_does_not_affect_another_api(self):
        failed_login(self.client, self.user.email)
        other = make_user(email="2024-111111@rtu.edu.ph")
        response = self.client.post(
            LOGIN,
            {"email": other.email, "password": STUDENT_PAYLOAD["password"]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_stale_count_older_than_24h_resets_on_next_attempt(self):
        old = timezone.now() - timezone.timedelta(hours=25)
        with patch("django.utils.timezone.now", return_value=old):
            failed_login(self.client, self.user.email)
        # Now: fresh attempt starts from 0 again
        response = failed_login(self.client, self.user.email)
        self.assertEqual(response.data["attempts_left"], 4)

    def test_login_status_returns_same_shape_for_known_and_unknown_email(self):
        response = self.client.post(LOGIN_STATUS, {"email": "nobody@rtu.edu.ph"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["locked"])
        self.assertIsNone(response.data["code"])
        self.assertEqual(response.data["retry_after"], 0)

        failed_login(self.client, self.user.email)
        failed_login(self.client, self.user.email)
        response = self.client.post(LOGIN_STATUS, {"email": self.user.email}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["locked"])
        self.assertIsNone(response.data["code"])

    def test_two_parallel_failures_do_not_skip_a_count(self):
        """Two concurrent failures for the same email should increment by 2, not 1."""
        from django.db import transaction

        results = []

        def do_failure():
            result = record_failure(self.user.email)
            results.append(result)

        with transaction.atomic():
            do_failure()
            do_failure()

        self.assertEqual(len(results), 2)
        # The second call should see failed_count incremented by the first
        self.assertEqual(results[1].attempts_left, 3)


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
)
class PasswordResetClearsLockoutTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = make_user()
        from rest_framework.throttling import ScopedRateThrottle
        self._orig_allow_request = ScopedRateThrottle.allow_request
        ScopedRateThrottle.allow_request = lambda self, request, view: True

    def tearDown(self):
        from rest_framework.throttling import ScopedRateThrottle
        ScopedRateThrottle.allow_request = self._orig_allow_request

    def test_password_reset_confirm_clears_the_lockout(self):
        from apps.accounts.verification import issue_code

        # Lock the account
        for _ in range(5):
            failed_login(self.client, self.user.email)

        # Verify the lock exists
        self.assertIsNotNone(current_lock(self.user.email))

        # Issue a code and confirm the password reset
        code = issue_code(self.user)
        response = self.client.post(
            "/api/v1/auth/password-reset/confirm/",
            {
                "email": self.user.email,
                "code": code,
                "password": "NewSecurePass123!",
                "password_confirm": "NewSecurePass123!",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Lock should be cleared
        self.assertIsNone(current_lock(self.user.email))

        # User can sign in at once with the new password
        response = self.client.post(
            LOGIN,
            {"email": self.user.email, "password": "NewSecurePass123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_login_status_after_refresh_returns_lock_state(self):
        failed_login(self.client, self.user.email)
        failed_login(self.client, self.user.email)
        response = self.client.post(LOGIN_STATUS, {"email": self.user.email}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["locked"])
        self.assertIsNone(response.data["code"])
