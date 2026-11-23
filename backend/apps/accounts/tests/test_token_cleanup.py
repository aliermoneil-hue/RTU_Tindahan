"""The prune_tokens command: dead rows go, live rows and fresh ones stay."""

from datetime import timedelta
from io import StringIO

from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.authtoken.models import Token

from apps.accounts.models import User


def make_user(email):
    user = User.objects.create_user(
        email=email,
        display_name=email.split("@")[0],
        password="SecurePass123!",
        member_type=User.MemberType.STUDENT,
        college="College of ICT",
        year_level=2,
    )
    user.verify()
    return user


def run(**options):
    out = StringIO()
    call_command("prune_tokens", stdout=out, **options)
    return out.getvalue()


@override_settings(AUTH_TOKEN_TTL_DAYS=14)
class PruneTokensTests(TestCase):
    def setUp(self):
        self.old = Token.objects.create(user=make_user("2024-777777@rtu.edu.ph"))
        self.fresh = Token.objects.create(user=make_user("2024-888888@rtu.edu.ph"))
        Token.objects.filter(pk=self.old.pk).update(
            created=timezone.now() - timedelta(days=15)
        )

    def test_expired_tokens_are_deleted_and_fresh_ones_are_kept(self):
        output = run()

        self.assertFalse(Token.objects.filter(pk=self.old.pk).exists())
        self.assertTrue(Token.objects.filter(pk=self.fresh.pk).exists())
        self.assertIn("Deleted 1 token", output)

    def test_dry_run_deletes_nothing(self):
        output = run(dry_run=True)

        self.assertTrue(Token.objects.filter(pk=self.old.pk).exists())
        self.assertIn("would be deleted", output)
        self.assertIn("nothing removed", output)

    def test_the_days_option_overrides_the_setting(self):
        output = run(days=20)

        self.assertTrue(Token.objects.filter(pk=self.old.pk).exists())
        self.assertIn("Deleted 0 token", output)

    @override_settings(AUTH_TOKEN_TTL_DAYS=0)
    def test_without_a_lifetime_nothing_is_ever_deleted(self):
        output = run()

        self.assertTrue(Token.objects.filter(pk=self.old.pk).exists())
        self.assertIn("never expire", output)
