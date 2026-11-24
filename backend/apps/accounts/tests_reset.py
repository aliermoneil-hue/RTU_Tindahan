"""The reset command is only safe if what it keeps is exactly what it claims.

A wipe is easy to write and hard to trust: the fear is that it takes the office's
categories with it, or the only account able to sign in. These tests pin both.
"""

from io import StringIO

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from apps.accounts.models import College, User
from apps.catalog.models import Category, Listing
from apps.forum.models import ForumPost
from apps.screening.models import ScreeningRule


class ResetSystemDataTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email="admin@rtu.edu.ph", display_name="Admin", password="AdminPass123!"
        )
        self.admin.role = "administrator"
        self.admin.is_staff = True
        self.admin.save()

        self.student = User.objects.create_user(
            email="2024-999999@rtu.edu.ph", display_name="Student", password="Pass12345!"
        )
        # The migrations seed these three, so the fixture borrows what is there
        # rather than colliding with it.
        self.college, _ = College.objects.get_or_create(
            code="CICT", defaults={"name": "College of ICT"}
        )
        self.category, _ = Category.objects.get_or_create(name="School Supplies")
        self.rule, _ = ScreeningRule.objects.get_or_create(
            phrase="answer key", defaults={"verdict": "rejected", "note": "AI-01"}
        )
        self.categories_before = Category.objects.count()
        self.colleges_before = College.objects.count()
        self.rules_before = ScreeningRule.objects.count()
        self.listing = Listing.objects.create(
            seller=self.student,
            category=self.category,
            title="Textbook",
            description="Used once.",
            price=100,
        )
        self.post = ForumPost.objects.create(
            author=self.student, kind="post", topic="General", body="Hello."
        )

    def run_command(self, *args):
        out, err = StringIO(), StringIO()
        call_command("reset_system_data", *args, stdout=out, stderr=err)
        return out.getvalue() + err.getvalue()

    def test_it_removes_member_content_and_keeps_configuration(self):
        output = self.run_command("--yes", "--keep-media")

        self.assertEqual(User.objects.count(), 1, "only the administrator should remain")
        self.assertTrue(User.objects.filter(email="admin@rtu.edu.ph").exists())
        self.assertEqual(Listing.objects.count(), 0)
        self.assertEqual(ForumPost.objects.count(), 0)

        self.assertEqual(
            Category.objects.count(), self.categories_before, "categories are configuration"
        )
        self.assertEqual(College.objects.count(), self.colleges_before)
        self.assertEqual(ScreeningRule.objects.count(), self.rules_before)
        self.assertIn("Empty. Configuration intact.", output)

    def test_dry_run_changes_nothing(self):
        output = self.run_command("--dry-run")

        self.assertEqual(User.objects.count(), 2)
        self.assertEqual(Listing.objects.count(), 1)
        self.assertIn("Dry run: nothing was changed.", output)

    def test_it_refuses_when_no_administrator_would_be_left(self):
        self.admin.delete()

        with self.assertRaises(CommandError):
            self.run_command("--yes")

        self.assertEqual(Listing.objects.count(), 1, "a refused reset must delete nothing")

    def test_the_administrator_keeps_their_own_token(self):
        from rest_framework.authtoken.models import Token

        admin_token = Token.objects.create(user=self.admin)
        student_token = Token.objects.create(user=self.student)

        self.run_command("--yes", "--keep-media")

        self.assertTrue(
            Token.objects.filter(key=admin_token.key).exists(),
            "deleting the admin's token would sign the only account out of its own site",
        )
        self.assertFalse(Token.objects.filter(key=student_token.key).exists())

    def test_a_staff_account_that_is_not_an_administrator_is_not_kept(self):
        self.student.is_staff = True
        self.student.role = "moderator"
        self.student.save()

        self.run_command("--yes", "--keep-media")

        self.assertFalse(User.objects.filter(email="2024-999999@rtu.edu.ph").exists())
        self.assertTrue(User.objects.filter(email="admin@rtu.edu.ph").exists())
