"""The college dimension: resolution, registration, picklist and integrity.

The data migration seeds the canonical colleges (CICT, OSA, ADMIN), so these
tests reuse those rows instead of creating duplicates of them.
"""

from django.db import IntegrityError
from django.db.models import ProtectedError
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import College, CollegeAlias, User


def cict():
    return College.objects.get(code="CICT")


def osa():
    return College.objects.get(code="OSA")


class CollegeResolutionTests(TestCase):
    def test_migration_seeded_the_synonyms(self):
        self.assertTrue(
            CollegeAlias.objects.filter(college=cict(), text="college of ict").exists()
        )

    def test_resolve_by_code(self):
        self.assertEqual(College.resolve("CICT"), cict())

    def test_resolve_by_name(self):
        self.assertEqual(
            College.resolve("College of Information and Communications Technology"),
            cict(),
        )

    def test_resolve_by_alias(self):
        self.assertEqual(College.resolve("College of ICT"), cict())
        self.assertEqual(College.resolve("BS Information Technology"), cict())

    def test_resolution_ignores_case_and_padding(self):
        self.assertEqual(College.resolve("  cict  "), cict())
        self.assertEqual(
            College.resolve("college   of   information and communications technology"),
            cict(),
        )

    def test_unknown_place_returns_none(self):
        self.assertIsNone(College.resolve("Hogwarts College of Magic"))
        self.assertIsNone(College.resolve(""))

    def test_alias_is_stored_normalised(self):
        alias = CollegeAlias.objects.create(college=cict(), text="  CICT  Campus ")
        alias.refresh_from_db()
        self.assertEqual(alias.text, "cict campus")

    def test_alias_text_is_unique(self):
        # One spelling may only point at one college, or resolution is ambiguous.
        with self.assertRaises(IntegrityError):
            CollegeAlias.objects.create(college=osa(), text="college of ict")

    def test_college_with_members_cannot_be_deleted(self):
        User.objects.create_user(
            email="2024-999991@rtu.edu.ph",
            display_name="Held Account",
            password="x",
            member_type=User.MemberType.STUDENT,
            college=cict(),
            year_level=1,
        )
        with self.assertRaises(ProtectedError):
            cict().delete()


class UserCollegeTests(TestCase):
    """CICT and its "College of ICT" synonym come from the data migration."""

    def test_string_college_is_resolved_to_the_shared_row(self):
        """Fixtures that still pass a name must land on one row, not a new one."""
        before = College.objects.count()
        first = User.objects.create_user(
            email="2024-900001@rtu.edu.ph",
            display_name="Alias Typist",
            password="x",
            member_type=User.MemberType.STUDENT,
            college="College of ICT",
            year_level=2,
        )
        second = User.objects.create_user(
            email="2024-900002@rtu.edu.ph",
            display_name="Name Typist",
            password="x",
            member_type=User.MemberType.STUDENT,
            college="College of Information and Communications Technology",
            year_level=2,
        )
        self.assertEqual(College.objects.count(), before)
        self.assertEqual(first.college_id, cict().pk)
        self.assertEqual(second.college_id, cict().pk)

    def test_serializer_reports_name_and_code(self):
        from apps.accounts.serializers import UserSerializer

        user = User.objects.create_user(
            email="2024-900003@rtu.edu.ph",
            display_name="Serialised",
            password="x",
            college=cict(),
        )
        data = UserSerializer(user).data
        self.assertEqual(data["college"], cict().name)
        self.assertEqual(data["college_code"], "CICT")


class CollegeApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        # The seeded administration row is irrelevant here; drop it so the
        # picklist assertion is deterministic.
        College.objects.filter(code="ADMIN").delete()
        College.objects.create(name="Retired Office", is_active=False)

    def payload(self, **overrides):
        data = {
            "email": "2024-910001@rtu.edu.ph",
            "display_name": "New Student",
            "password": "SecurePass123!",
            "password_confirm": "SecurePass123!",
            "member_type": "student",
            "college": "CICT",
            "year_level": 1,
            "contact_number": "09171234567",
            "privacy_consent": True,
        }
        data.update(overrides)
        return data

    def test_picklist_lists_active_places_only(self):
        response = self.client.get("/api/v1/colleges/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        codes = [row["code"] for row in response.data]
        self.assertEqual(codes, ["CICT", "OSA"])
        self.assertEqual(response.data[0]["name"], cict().name)
        self.assertEqual(response.data[0]["kind"], "college")

    def test_registration_accepts_an_alias_and_stores_one_row(self):
        before = College.objects.count()
        response = self.client.post(
            "/api/v1/auth/register/",
            self.payload(college="College of ICT"),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        user = User.objects.get(email="2024-910001@rtu.edu.ph")
        self.assertEqual(user.college_id, cict().pk)
        self.assertEqual(College.objects.count(), before)

    def test_registration_rejects_an_unknown_college(self):
        response = self.client.post(
            "/api/v1/auth/register/", self.payload(college="Hogwarts"), format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Unknown college", str(response.data["college"]))
        self.assertFalse(User.objects.filter(email="2024-910001@rtu.edu.ph").exists())
