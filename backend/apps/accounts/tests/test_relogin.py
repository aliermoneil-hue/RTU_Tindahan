"""SE-05 lockout loop: signing in again must revive a session that aged out.

A token re-issued by /auth/login/ used to carry the last_seen of the session
it ended, so a user who hit the 30-minute idle limit was refused again on the
very first request after signing back in — no matter how many times they
signed in. These tests pin the fix: sign-in restarts the idle clock.
"""

from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from ..models import TokenActivity, User

LOGIN = "/api/v1/auth/login/"
AUTHED_PING = "/api/v1/auth/me/"


class ReLoginAfterIdleExpiryTests(APITestCase):
    def setUp(self):
        self.email = "2024-000077@rtu.edu.ph"
        self.password = "SecurePass123!"
        self.user = User.objects.create_user(
            email=self.email,
            display_name="Re-login Tester",
            password=self.password,
            member_type=User.MemberType.STUDENT,
            college="College of Business Administration and Accountancy",
            year_level=3,
        )
        # the login flow only hands tokens to verified accounts
        self.user.verified_at = timezone.now()
        self.user.save()

    def _sign_in(self):
        return self.client.post(
            LOGIN,
            {"email": self.email, "password": self.password},
            format="json",
        )

    def test_a_re_login_revives_a_session_that_went_idle(self):
        issued = self._sign_in()
        self.assertEqual(issued.status_code, status.HTTP_200_OK)
        key = issued.data["token"]

        # the session then sits unused past AUTH_IDLE_MINUTES
        token = Token.objects.get(key=key)
        TokenActivity.objects.update_or_create(
            token=token,
            defaults={"last_seen": timezone.now() - timedelta(minutes=31)},
        )

        # using it now is refused — SE-05 doing its job
        refused = self.client.get(AUTHED_PING, HTTP_AUTHORIZATION=f"Token {key}")
        self.assertEqual(refused.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(refused.json()["code"], "session_idle")

        # signing back in hands back the same token...
        again = self._sign_in()
        self.assertEqual(again.status_code, status.HTTP_200_OK)
        self.assertEqual(again.data["token"], key)

        # ...and the very next request must be accepted, not judged idle again
        revived = self.client.get(AUTHED_PING, HTTP_AUTHORIZATION=f"Token {key}")
        self.assertEqual(
            revived.status_code,
            status.HTTP_200_OK,
            revived.content,
        )

    def test_sign_in_restarts_the_idle_clock_not_just_the_refusal(self):
        issued = self._sign_in()
        key = issued.data["token"]
        token = Token.objects.get(key=key)

        # stale the activity row far beyond the idle window
        TokenActivity.objects.update_or_create(
            token=token,
            defaults={"last_seen": timezone.now() - timedelta(minutes=90)},
        )

        self._sign_in()

        activity = TokenActivity.objects.get(token=token)
        self.assertLess(
            timezone.now() - activity.last_seen,
            timedelta(minutes=2),
            "sign-in must stamp the token's activity to the current time",
        )
