"""PX-06: the JSON backup, an import of one, and the reset."""

import json

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.json_backup import export_payload, import_payload, parse_payload, reset_content
from apps.accounts.models import User
from apps.catalog.models import Category, Listing, ListingVariant
from apps.forum.models import ForumPost


def make_user(email, role=User.Role.USER):
    user = User.objects.create_user(
        email=email,
        display_name=email.split("@")[0],
        password="SecurePass123!",
        member_type=User.MemberType.STUDENT,
        college="College of ICT",
        year_level=2,
    )
    user.role = role
    user.verify()
    return user


class JsonBackupTests(TestCase):
    def setUp(self):
        self.admin = make_user("admin-json@rtu.edu.ph", role=User.Role.ADMINISTRATOR)
        self.seller = make_user("2024-660001@rtu.edu.ph")
        self.category = Category.objects.create(name="Books and Academic Materials")
        self.listing = Listing.objects.create(
            seller=self.seller,
            category=self.category,
            title="Calculus reviewer",
            description="Clean copy.",
            price=150,
        )
        ListingVariant.objects.create(
            listing=self.listing, name="One copy", price=150, on_hand=1, available=1
        )
        ForumPost.objects.create(author=self.seller, kind=ForumPost.Kind.NOTICE, title="Hi", body="Hello")

    def test_the_backup_holds_the_content_and_counts_it(self):
        payload = export_payload()

        self.assertEqual(payload["format"], "tindahan-json-backup")
        self.assertEqual(payload["version"], 1)
        self.assertEqual(payload["counts"]["catalog.Listing"], 1)
        self.assertEqual(payload["counts"]["forum.ForumPost"], 1)
        self.assertEqual(len(payload["objects"]["catalog.Listing"]), 1)
        self.assertEqual(payload["objects"]["catalog.Listing"][0]["title"], "Calculus reviewer")

    def test_no_password_hash_leaves_the_building(self):
        payload = export_payload()

        blob = json.dumps(payload)
        self.assertNotIn("pbkdf2", blob)
        self.assertNotIn(self.seller.password, blob)

    def test_a_backup_restores_what_was_removed(self):
        data = json.loads(json.dumps(export_payload()))
        self.listing.delete()
        self.assertFalse(Listing.objects.exists())

        written = import_payload(data)

        self.assertEqual(written["catalog.Listing"], 1)
        self.assertEqual(Listing.objects.get().title, "Calculus reviewer")
        self.assertEqual(ListingVariant.objects.count(), 1)

    def test_an_import_writes_over_the_same_key_and_deletes_nothing_else(self):
        data = json.loads(json.dumps(export_payload()))
        Listing.objects.create(
            seller=self.seller,
            category=self.category,
            title="A later listing",
            description="Made after the backup.",
            price=99,
        )

        import_payload(data)

        self.assertEqual(Listing.objects.count(), 2)
        self.assertTrue(Listing.objects.filter(title="A later listing").exists())

    def test_a_file_that_is_not_a_backup_is_refused(self):
        with self.assertRaises(Exception) as caught:
            parse_payload(b'{"format": "something-else"}')
        self.assertIn("not a Tindahan backup", str(caught.exception))

    def test_a_table_this_build_does_not_know_is_refused(self):
        with self.assertRaises(Exception) as caught:
            parse_payload(
                json.dumps(
                    {
                        "format": "tindahan-json-backup",
                        "version": 1,
                        "objects": {"secrets.Passwords": []},
                    }
                ).encode()
            )
        self.assertIn("does not know", str(caught.exception))

    def test_a_reset_clears_member_content_and_keeps_the_source(self):
        cleared = reset_content()

        self.assertEqual(Listing.objects.count(), 0)
        self.assertEqual(ForumPost.objects.count(), 0)
        self.assertEqual(cleared["catalog.Listing"], 1)
        # kept: accounts, categories
        self.assertTrue(User.objects.filter(pk=self.admin.pk).exists())
        self.assertTrue(Category.objects.filter(pk=self.category.pk).exists())

    def test_a_reset_keeps_the_official_store_catalogue(self):
        official = Listing.objects.create(
            seller=self.admin,
            category=self.category,
            title="Official Uniform",
            description="Office stock.",
            price=500,
            is_official=True,
        )

        reset_content()

        self.assertTrue(Listing.objects.filter(pk=official.pk).exists())


class JsonBackupApiTests(APITestCase):
    def setUp(self):
        self.admin = make_user("admin-json-api@rtu.edu.ph", role=User.Role.ADMINISTRATOR)
        self.member = make_user("2024-660002@rtu.edu.ph")
        self.category = Category.objects.create(name="Books and Academic Materials")
        self.listing = Listing.objects.create(
            seller=self.member,
            category=self.category,
            title="Reviewer",
            description="Clean.",
            price=100,
        )

    def test_an_administrator_downloads_a_json_file(self):
        self.client.force_authenticate(self.admin)

        response = self.client.get("/api/v1/admin/backup/json/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "application/json")
        self.assertIn("attachment;", response["Content-Disposition"])
        payload = json.loads(response.content)
        self.assertEqual(payload["format"], "tindahan-json-backup")

    def test_an_import_needs_the_word(self):
        self.client.force_authenticate(self.admin)
        upload = SimpleUploadedFile(
            "backup.json", b"{}", content_type="application/json"
        )

        refused = self.client.post(
            "/api/v1/admin/backup/import/", {"file": upload, "confirm": "yes"}, format="multipart"
        )

        self.assertEqual(refused.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("IMPORT", refused.json()["detail"])

    def test_an_import_needs_a_file(self):
        self.client.force_authenticate(self.admin)

        refused = self.client.post(
            "/api/v1/admin/backup/import/", {"confirm": "IMPORT"}, format="json"
        )

        self.assertEqual(refused.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Attach", refused.json()["detail"])

    def test_an_import_of_a_real_file_writes_the_rows(self):
        payload = export_payload()
        self.listing.delete()
        self.client.force_authenticate(self.admin)
        upload = SimpleUploadedFile(
            "backup.json",
            json.dumps(payload).encode(),
            content_type="application/json",
        )

        restored = self.client.post(
            "/api/v1/admin/backup/import/",
            {"file": upload, "confirm": "IMPORT"},
            format="multipart",
        )

        self.assertEqual(restored.status_code, status.HTTP_200_OK)
        self.assertEqual(restored.json()["written"]["catalog.Listing"], 1)
        self.assertTrue(Listing.objects.filter(title="Reviewer").exists())

    def test_a_reset_needs_the_word(self):
        self.client.force_authenticate(self.admin)

        refused = self.client.post("/api/v1/admin/backup/reset/", {"confirm": "no"}, format="json")

        self.assertEqual(refused.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("RESET", refused.json()["detail"])
        self.assertTrue(Listing.objects.exists())

    def test_a_reset_clears_and_says_what_it_kept(self):
        self.client.force_authenticate(self.admin)

        done = self.client.post(
            "/api/v1/admin/backup/reset/", {"confirm": "RESET"}, format="json"
        )

        self.assertEqual(done.status_code, status.HTTP_200_OK)
        self.assertEqual(done.json()["cleared"]["catalog.Listing"], 1)
        self.assertIn("accounts and their credentials", done.json()["kept"])
        self.assertFalse(Listing.objects.exists())
        self.assertTrue(User.objects.filter(pk=self.admin.pk).exists())

    def test_a_member_cannot_use_any_of_the_three(self):
        self.client.force_authenticate(self.member)

        for path in (
            "/api/v1/admin/backup/json/",
            "/api/v1/admin/backup/import/",
            "/api/v1/admin/backup/reset/",
        ):
            if path.endswith("json/"):
                response = self.client.get(path)
            else:
                response = self.client.post(path, {"confirm": "IMPORT"}, format="json")
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN, path)
