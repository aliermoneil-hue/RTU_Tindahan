"""Auth hardening (AV-06): password reset, token lifetime, ending sessions."""

from datetime import timedelta
from unittest.mock import patch

from django.core import mail
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from apps.accounts.models import PasswordResetCode, User
from apps.accounts.verification import issue_reset_code

RESET_REQUEST = "/api/v1/auth/password-reset/"
RESET_CONFIRM = "/api/v1/auth/password-reset/confirm/"


def make_user(email="2024-123456@rtu.edu.ph", password="SecurePass123!"):
    user = User.objects.create_user(
        email=email,
        display_name="Neil",
        password=password,
        member_type=User.MemberType.STUDENT,
        college="College of ICT",
        year_level=3,
    )
    user.role = User.Role.USER
    user.verify()
    return user


class PasswordResetRequestTests(APITestCase):
    def setUp(self):
        cache.clear()  # throttle and cooldown counters are process-wide
        self.user = make_user()

    def test_an_known_address_gets_a_code_by_email(self):
        response = self.client.post(RESET_REQUEST, {"email": self.user.email}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [self.user.email])
        self.assertIn("password", mail.outbox[0].subject.lower())
        self.assertIn("reset code", mail.outbox[0].body.lower())
        self.assertTrue(PasswordResetCode.objects.filter(user=self.user).exists())

    def test_the_code_is_never_stored_in_the_clear(self):
        self.client.post(RESET_REQUEST, {"email": self.user.email}, format="json")

        record = PasswordResetCode.objects.get(user=self.user)
        self.assertNotEqual(record.code_hash, "")
        self.assertNotIn("code", record.code_hash)
        # The plain code only ever exists in the email body.
        body = mail.outbox[0].body
        self.assertIn("password reset code is:", body.lower())

    def test_an_unknown_address_gets_the_same_answer_and_no_email(self):
        response = self.client.post(RESET_REQUEST, {"email": "nobody@rtu.edu.ph"}, format="json")
        known = self.client.post(RESET_REQUEST, {"email": self.user.email}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["detail"], known.json()["detail"])
        self.assertEqual(PasswordResetCode.objects.count(), 1)  # only the real one
        self.assertEqual(len(mail.outbox), 1)

    def test_a_second_request_inside_the_cooldown_does_not_send_again(self):
        self.client.post(RESET_REQUEST, {"email": self.user.email}, format="json")
        second = self.client.post(RESET_REQUEST, {"email": self.user.email}, format="json")

        self.assertEqual(second.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)


@override_settings(AUTH_TOKEN_TTL_DAYS=14)
class PasswordResetConfirmTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = make_user()
        self.code = issue_reset_code(self.user)

    def confirm(self, **overrides):
        payload = {
            "email": self.user.email,
            "code": self.code,
            "password": "BrandNewPass456!",
            "password_confirm": "BrandNewPass456!",
        }
        payload.update(overrides)
        return self.client.post(RESET_CONFIRM, payload, format="json")

    def test_a_good_code_changes_the_password_and_ends_sessions(self):
        Token.objects.create(user=self.user)

        response = self.confirm()

        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("BrandNewPass456!"))
        self.assertEqual(Token.objects.filter(user=self.user).count(), 0)
        self.assertFalse(PasswordResetCode.objects.filter(user=self.user).exists())

    def test_the_new_password_is_what_signs_in(self):
        self.confirm()

        refused = self.client.post(
            "/api/v1/auth/login/",
            {"email": self.user.email, "password": "SecurePass123!"},
            format="json",
        )
        allowed = self.client.post(
            "/api/v1/auth/login/",
            {"email": self.user.email, "password": "BrandNewPass456!"},
            format="json",
        )

        self.assertEqual(refused.status_code, 400)
        self.assertEqual(allowed.status_code, 200)
        self.assertIn("token", allowed.json())

    def test_a_wrong_code_leaves_the_password_alone(self):
        response = self.confirm(code="000000")

        self.assertEqual(response.status_code, 400)
        self.assertIn("not right", response.json()["detail"])
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("SecurePass123!"))

    def test_an_unknown_address_cannot_be_distinguished_from_a_wrong_code(self):
        wrong_code = self.confirm(code="000000")
        unknown = self.confirm(email="nobody@rtu.edu.ph")

        self.assertEqual(unknown.status_code, 400)
        self.assertEqual(unknown.json()["detail"], wrong_code.json()["detail"])

    def test_an_expired_code_is_refused(self):
        PasswordResetCode.objects.filter(user=self.user).update(
            expires_at=timezone.now() - timedelta(minutes=1)
        )

        response = self.confirm()

        self.assertEqual(response.status_code, 400)
        self.assertIn("expired", response.json()["detail"])

    def test_five_wrong_tries_burn_the_code(self):
        for _ in range(5):
            self.confirm(code="000000")
            cache.clear()  # the endpoint's own throttle is 5/hour; isolate it

        sixth = self.confirm()

        self.assertEqual(sixth.status_code, 400)
        self.assertIn("not right", sixth.json()["detail"])
        self.assertFalse(PasswordResetCode.objects.filter(user=self.user).exists())

    def test_mismatched_passwords_are_refused(self):
        response = self.confirm(password_confirm="SomethingElse789!")

        self.assertEqual(response.status_code, 400)
        self.assertIn("password_confirm", response.json())

    def test_a_weak_password_is_refused(self):
        response = self.confirm(password="12345678", password_confirm="12345678")

        self.assertEqual(response.status_code, 400)
        self.assertIn("password", response.json())


@override_settings(AUTH_TOKEN_TTL_DAYS=14)
class TokenLifetimeTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = make_user()
        self.token = Token.objects.create(user=self.user)

    def auth(self, key):
        return {"HTTP_AUTHORIZATION": f"Token {key}"}

    def test_a_fresh_token_works(self):
        response = self.client.get("/api/v1/auth/me/", **self.auth(self.token.key))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["email"], self.user.email)

    def test_an_old_token_is_refused_with_a_clear_reason(self):
        Token.objects.filter(pk=self.token.pk).update(
            created=timezone.now() - timedelta(days=15)
        )

        response = self.client.get("/api/v1/auth/me/", **self.auth(self.token.key))

        self.assertEqual(response.status_code, 401)
        self.assertIn("expired", response.json()["detail"])

    @override_settings(AUTH_TOKEN_TTL_DAYS=0)
    def test_zero_disables_the_check_for_a_team_that_has_not_migrated(self):
        Token.objects.filter(pk=self.token.pk).update(
            created=timezone.now() - timedelta(days=365)
        )

        response = self.client.get("/api/v1/auth/me/", **self.auth(self.token.key))

        self.assertEqual(response.status_code, 200)

    def test_refresh_rotates_the_token_and_kills_the_old_one(self):
        response = self.client.post("/api/v1/auth/token/refresh/", **self.auth(self.token.key))

        self.assertEqual(response.status_code, 200)
        new_key = response.json()["token"]
        self.assertNotEqual(new_key, self.token.key)
        self.assertEqual(response.json()["expires_in_days"], 14)

        stale = self.client.get("/api/v1/auth/me/", **self.auth(self.token.key))
        fresh = self.client.get("/api/v1/auth/me/", **self.auth(new_key))

        self.assertEqual(stale.status_code, 401)
        self.assertEqual(fresh.status_code, 200)

    def test_logout_all_ends_the_session(self):
        response = self.client.post("/api/v1/auth/logout-all/", **self.auth(self.token.key))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["sessions_ended"], 1)
        self.assertEqual(Token.objects.filter(user=self.user).count(), 0)

        after = self.client.get("/api/v1/auth/me/", **self.auth(self.token.key))
        self.assertEqual(after.status_code, 401)

    def test_signing_in_again_after_expiry_mints_a_working_token(self):
        Token.objects.filter(pk=self.token.pk).update(
            created=timezone.now() - timedelta(days=15)
        )
        # authtoken keeps one row per user, so a naive login would hand back
        # the dead key and the account would look broken.
        response = self.client.post(
            "/api/v1/auth/login/",
            {"email": self.user.email, "password": "SecurePass123!"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        fresh = response.json()["token"]
        self.assertNotEqual(fresh, self.token.key)
        self.assertEqual(
            self.client.get("/api/v1/auth/me/", **self.auth(fresh)).status_code, 200
        )


class PasswordChangedEmailTests(APITestCase):
    """AV-06: the one mail that arrives after the change, so it must be true."""

    def setUp(self):
        cache.clear()
        self.user = make_user()
        self.code = issue_reset_code(self.user)

    def confirm(self, **overrides):
        payload = {
            "email": self.user.email,
            "code": self.code,
            "password": "BrandNewPass456!",
            "password_confirm": "BrandNewPass456!",
        }
        payload.update(overrides)
        return self.client.post(RESET_CONFIRM, payload, format="json")

    def test_the_account_holder_is_told_the_password_changed(self):
        response = self.confirm()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        sent = mail.outbox[0]
        self.assertEqual(sent.to, [self.user.email])
        self.assertIn("password was changed", sent.subject.lower())
        self.assertIn("signed out", sent.body.lower())
        self.assertIn("if you did not change it", sent.body.lower())
        # It is a notification, never a code: nothing in it can be spent.
        self.assertNotRegex(sent.body, r"\b\d{6}\b")

    def test_no_mail_goes_out_when_the_code_is_wrong(self):
        response = self.confirm(code="000000")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(mail.outbox, [])

    def test_no_mail_goes_out_when_the_code_has_expired(self):
        PasswordResetCode.objects.filter(user=self.user).update(
            expires_at=timezone.now() - timedelta(minutes=1)
        )

        response = self.confirm()

        self.assertEqual(response.status_code, 400)
        self.assertEqual(mail.outbox, [])

    def test_a_failed_mail_does_not_undo_the_change(self):
        with patch(
            "apps.accounts.views.send_password_changed_email",
            side_effect=RuntimeError("smtp down"),
        ):
            response = self.confirm()

        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("BrandNewPass456!"))
        self.assertEqual(Token.objects.filter(user=self.user).count(), 0)


@override_settings(AUTH_IDLE_MINUTES=30, AUTH_IDLE_TOUCH_SECONDS=60)
class IdleSessionTests(APITestCase):
    """SE-05: thirty minutes of no activity ends the session.

    The token's age is not the question — a session used a minute ago is alive
    however old the token is, and one abandoned an hour ago is over however new
    it is.
    """

    def setUp(self):
        self.user = make_user("2024-121212@rtu.edu.ph")
        self.token = Token.objects.create(user=self.user)

    def call(self, key=None):
        return self.client.get(
            "/api/v1/auth/me/", HTTP_AUTHORIZATION=f"Token {key or self.token.key}"
        )

    def idle_for(self, minutes):
        from apps.accounts.models import TokenActivity

        self.call()  # a first request, to stamp the row
        TokenActivity.objects.filter(token=self.token).update(
            last_seen=timezone.now() - timedelta(minutes=minutes)
        )

    def test_a_session_used_just_now_works(self):
        self.assertEqual(self.call().status_code, 200)

    def test_a_session_idle_for_forty_minutes_is_refused(self):
        self.idle_for(40)

        response = self.call()

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["code"], "session_idle")
        self.assertIn("30 minutes of no activity", response.json()["detail"])

    def test_a_session_idle_for_twenty_nine_minutes_still_works(self):
        self.idle_for(29)

        self.assertEqual(self.call().status_code, 200)

    def test_a_request_moves_the_clock_forward(self):
        from apps.accounts.models import TokenActivity

        self.idle_for(25)
        self.assertEqual(self.call().status_code, 200)

        row = TokenActivity.objects.get(token=self.token)
        self.assertLess((timezone.now() - row.last_seen).total_seconds(), 5)

    def test_the_stamp_is_not_written_on_every_request(self):
        from apps.accounts.models import TokenActivity

        self.call()
        first = TokenActivity.objects.get(token=self.token).last_seen
        self.call()
        second = TokenActivity.objects.get(token=self.token).last_seen

        # Two requests inside the touch window, one write.
        self.assertEqual(first, second)

    @override_settings(AUTH_IDLE_MINUTES=0)
    def test_zero_turns_the_idle_check_off(self):
        self.idle_for(600)

        self.assertEqual(self.call().status_code, 200)

    def test_a_token_with_no_activity_row_is_stamped_rather_than_refused(self):
        # A token issued before this check existed must not lock everyone out.
        self.assertEqual(self.call().status_code, 200)
        self.assertTrue(
            __import__(
                "apps.accounts.models", fromlist=["TokenActivity"]
            ).TokenActivity.objects.filter(token=self.token).exists()
        )

    def test_signing_out_removes_the_activity_row(self):
        from apps.accounts.models import TokenActivity

        self.call()
        self.client.post(
            "/api/v1/auth/logout/", HTTP_AUTHORIZATION=f"Token {self.token.key}"
        )

        self.assertEqual(TokenActivity.objects.filter(token_id=self.token.pk).count(), 0)


class UnlockLoginCommandTests(TestCase):
    """The rescue hatch: five wrong passwords is a fifteen-minute lock."""

    def test_the_command_clears_a_lock(self):
        from apps.accounts.lockout import current_lock, record_failure
        from django.core.management import call_command

        email = "2024-131313@rtu.edu.ph"
        make_user(email)
        for _ in range(5):
            record_failure(email)
        self.assertIsNotNone(current_lock(email))

        call_command("unlock_login", email, verbosity=0)

        self.assertIsNone(current_lock(email))
