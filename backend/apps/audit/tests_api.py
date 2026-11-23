"""Tests for the Users and audit screen and its API."""

import sqlite3
import tempfile
from decimal import Decimal

from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase, APITransactionTestCase

from apps.accounts.models import User
from apps.audit.models import AuditLog
from apps.catalog.models import Category, Listing
from apps.notifications.models import Notification


def make_user(email, **extra):
    user = User.objects.create_user(
        email=email,
        display_name=extra.pop("display_name", email.split("@")[0]),
        password="SecurePass123!",
        member_type=User.MemberType.STUDENT,
        college="College of ICT",
        year_level=2,
        **extra,
    )
    user.verify()
    return user


def rows(response):
    data = response.json()
    return data["results"] if isinstance(data, dict) and "results" in data else data


class AdminUsersApiTests(APITestCase):
    def setUp(self):
        self.admin = make_user(
            "admin@rtu.edu.ph",
            role=User.Role.ADMINISTRATOR,
            display_name="Ada Admin",
        )
        self.moderator = make_user("2024-000003@rtu.edu.ph", role=User.Role.MODERATOR)
        self.seller = make_user("2024-111111@rtu.edu.ph", display_name="Sam Seller")
        self.target = make_user("2024-222222@rtu.edu.ph", display_name="Tim Target")
        self.category = Category.objects.create(name="Gadgets")
        self.listing = Listing.objects.create(
            seller=self.target,
            category=self.category,
            title="Target's item",
            description="On sale.",
            listing_type=Listing.Type.PRODUCT,
            condition=Listing.Condition.USED,
            price=Decimal("100.00"),
            quantity=2,
            meetup_place="Main lobby",
            moderation_status=Listing.ModerationStatus.APPROVED,
            availability_status=Listing.AvailabilityStatus.AVAILABLE,
        )
        self.target_token = Token.objects.create(user=self.target)

    def set_status(self, user, new_status, note="", actor=None):
        self.client.force_authenticate(actor or self.admin)
        return self.client.post(
            f"/api/v1/admin/users/{user.pk}/status/",
            {"status": new_status, "note": note},
            format="json",
        )

    def test_staff_can_list_and_filter_users(self):
        self.client.force_authenticate(self.moderator)
        response = self.client.get("/api/v1/admin/users/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(response.json()["count"], 4)
        target_row = next(
            row for row in rows(response) if row["email"] == self.target.email
        )
        self.assertEqual(target_row["listing_count"], 1)
        self.assertEqual(target_row["status"], "active")

        filtered = self.client.get(
            f"/api/v1/admin/users/?q={self.target.email}&role=user&status=active"
        )
        self.assertEqual(len(rows(filtered)), 1)

        self.client.force_authenticate(self.seller)
        self.assertEqual(
            self.client.get("/api/v1/admin/users/").status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_suspending_requires_a_reason(self):
        missing = self.set_status(self.target, "suspended")
        short = self.set_status(self.target, "suspended", note="bad")

        self.assertEqual(missing.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(short.status_code, status.HTTP_400_BAD_REQUEST)
        self.target.refresh_from_db()
        self.assertEqual(self.target.status, User.Status.ACTIVE)

    def test_only_an_administrator_may_change_a_status(self):
        response = self.set_status(
            self.target, "suspended", note="Repeated no-shows", actor=self.moderator
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.target.refresh_from_db()
        self.assertEqual(self.target.status, User.Status.ACTIVE)

    def test_suspending_ends_the_session_hides_listings_and_audits(self):
        old_token = self.target_token.key
        response = self.set_status(
            self.target, "suspended", note="Repeated no-shows at meetups"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.target.refresh_from_db()
        self.assertEqual(self.target.status, User.Status.SUSPENDED)
        self.assertEqual(self.target.status_changed_by, self.admin)
        self.assertFalse(Token.objects.filter(user=self.target).exists())

        # The old token no longer works.
        self.client.force_authenticate(None)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {old_token}")
        self.assertEqual(
            self.client.get("/api/v1/notifications/").status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
        self.client.credentials()

        # The listing leaves the marketplace.
        self.assertEqual(rows(self.client.get("/api/v1/listings/")), [])

        entry = AuditLog.objects.get(action="suspend user")
        self.assertEqual(entry.actor, self.admin)
        self.assertEqual(entry.target_id, self.target.email)
        self.assertIn("no-shows", entry.note)

        # And signing in is refused.
        login = self.client.post(
            "/api/v1/auth/login/",
            {"email": self.target.email, "password": "SecurePass123!"},
            format="json",
        )
        self.assertIn(
            login.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)
        )

    def test_restoring_access_notifies_and_audits(self):
        self.set_status(self.target, "banned", note="Abusive messages to a seller")

        restored = self.set_status(self.target, "active", note="Appeal accepted")

        self.assertEqual(restored.status_code, status.HTTP_200_OK)
        self.target.refresh_from_db()
        self.assertEqual(self.target.status, User.Status.ACTIVE)
        self.assertTrue(
            Notification.objects.filter(
                user=self.target, text__icontains="access was restored"
            ).exists()
        )
        self.assertTrue(AuditLog.objects.filter(action="restore user").exists())

    def test_staff_and_your_own_account_are_protected(self):
        on_staff = self.set_status(self.moderator, "suspended", note="Not allowed here")
        on_self = self.set_status(self.admin, "suspended", note="Not my own account")

        self.assertEqual(on_staff.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(on_self.status_code, status.HTTP_400_BAD_REQUEST)

    def test_role_change_is_administrator_only_and_audited(self):
        self.client.force_authenticate(self.moderator)
        refused = self.client.post(
            f"/api/v1/admin/users/{self.target.pk}/role/",
            {"role": "moderator"},
            format="json",
        )
        self.assertEqual(refused.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.admin)
        changed = self.client.post(
            f"/api/v1/admin/users/{self.target.pk}/role/",
            {"role": "moderator"},
            format="json",
        )
        self.assertEqual(changed.status_code, status.HTTP_200_OK)
        self.target.refresh_from_db()
        self.assertEqual(self.target.role, User.Role.MODERATOR)
        self.assertTrue(AuditLog.objects.filter(action="change role").exists())

        own = self.client.post(
            f"/api/v1/admin/users/{self.admin.pk}/role/",
            {"role": "moderator"},
            format="json",
        )
        self.assertEqual(own.status_code, status.HTTP_400_BAD_REQUEST)

    def test_the_last_administrator_cannot_be_demoted(self):
        superuser = User.objects.create_superuser(
            email="root@rtu.edu.ph",
            display_name="Root",
            password="SecurePass123!",
        )
        superuser.role = User.Role.USER
        superuser.save(update_fields=["role"])

        self.client.force_authenticate(superuser)
        response = self.client.post(
            f"/api/v1/admin/users/{self.admin.pk}/role/",
            {"role": "user"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("At least one administrator", str(response.json()))

    def test_the_audit_log_is_staff_only_and_filterable(self):
        pending = Listing.objects.create(
            seller=self.seller,
            category=self.category,
            title="Pending item",
            description="Waiting.",
            listing_type=Listing.Type.PRODUCT,
            condition=Listing.Condition.USED,
            price=Decimal("50.00"),
            quantity=1,
            meetup_place="Main lobby",
        )

        self.client.force_authenticate(self.moderator)
        self.client.post(f"/api/v1/listings/{pending.slug}/approve/")

        log = self.client.get("/api/v1/admin/audit/")
        self.assertEqual(log.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(log.json()["count"], 1)
        self.assertEqual(rows(log)[0]["action"], "approve listing")
        self.assertEqual(rows(log)[0]["target_name"], "Pending item")

        filtered = self.client.get("/api/v1/admin/audit/?action=approve listing")
        self.assertEqual(len(rows(filtered)), 1)

        # Rejecting keeps the reason in the note.
        self.client.post(
            f"/api/v1/listings/{pending.slug}/reject/",
            {"reason": "Missing a photo of the actual item"},
            format="json",
        )
        rejected = self.client.get("/api/v1/admin/audit/?action=reject listing")
        self.assertIn("Missing a photo", rows(rejected)[0]["note"])

        self.client.force_authenticate(self.seller)
        self.assertEqual(
            self.client.get("/api/v1/admin/audit/").status_code,
            status.HTTP_403_FORBIDDEN,
        )


class DatabaseBackupTests(APITransactionTestCase):
    """The staff backup must be the real database, not the browser snapshot."""

    def setUp(self):
        self.admin = make_user("admin@rtu.edu.ph", role=User.Role.ADMINISTRATOR)
        self.staff = make_user("2024-000002@rtu.edu.ph", role=User.Role.OFFICE_STAFF)
        self.moderator = make_user("2024-000003@rtu.edu.ph", role=User.Role.MODERATOR)

    def test_read_only_roles_cannot_download_the_database(self):
        for user in (self.staff, self.moderator):
            self.client.force_authenticate(user)
            response = self.client.get("/api/v1/admin/backup/")
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_an_administrator_gets_a_valid_sqlite_copy(self):
        self.client.force_authenticate(self.admin)

        response = self.client.get("/api/v1/admin/backup/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "application/vnd.sqlite3")
        self.assertIn("attachment;", response["Content-Disposition"])
        self.assertTrue(response.content.startswith(b"SQLite format 3"))

        with tempfile.NamedTemporaryFile(suffix=".sqlite3") as handle:
            handle.write(response.content)
            handle.flush()
            database = sqlite3.connect(handle.name)
            emails = [row[0] for row in database.execute("select email from accounts_user")]
            database.close()

        self.assertIn("admin@rtu.edu.ph", emails)
        self.assertTrue(
            AuditLog.objects.filter(action="backup_download", actor=self.admin).exists()
        )
