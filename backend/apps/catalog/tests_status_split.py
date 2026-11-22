"""The split state: two independent facts, one legacy view of them."""

from django.db import IntegrityError, transaction
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.catalog.models import Category, Listing


def make_user(email, role=User.Role.USER):
    user = User.objects.create_user(
        email=email,
        display_name=email.split("@")[0],
        password="x",
        member_type=User.MemberType.STUDENT,
        college="CICT",
        year_level=1,
    )
    user.role = role
    user.verify()
    return user


class ListingLegacyStatusTests(TestCase):
    """`status` is now derived; the old single value must still read back."""

    @classmethod
    def setUpTestData(cls):
        cls.seller = make_user("2024-555001@rtu.edu.ph")
        cls.category = Category.objects.create(name="Snacks")

    def listing(self, moderation, availability):
        return Listing.objects.create(
            seller=self.seller,
            category=self.category,
            title=f"{moderation} {availability}",
            description="x",
            price="10.00",
            quantity=1,
            meetup_place="Gate",
            moderation_status=moderation,
            availability_status=availability,
        )

    def test_each_pair_reads_back_as_the_old_value(self):
        cases = [
            ("draft", "available", "draft"),
            ("pending_screening", "available", "pending_screening"),
            ("approved", "available", "approved"),
            ("needs_review", "available", "needs_review"),
            ("rejected", "unavailable", "rejected"),
            ("approved", "sold", "sold"),
            ("approved", "unavailable", "unavailable"),
            ("approved", "removed", "removed"),
        ]
        for moderation, availability, old in cases:
            with self.subTest(moderation=moderation, availability=availability):
                self.assertEqual(self.listing(moderation, availability).status, old)

    def test_a_listing_can_be_approved_and_out_of_stock(self):
        """The combination the old single column could not express."""
        listing = self.listing("approved", "unavailable")
        self.assertFalse(listing.is_published)
        self.assertEqual(listing.status, "unavailable")

    def test_reject_drives_availability_too(self):
        listing = self.listing("pending_screening", "available")
        listing.reject("Prohibited item")
        listing.refresh_from_db()
        self.assertEqual(listing.moderation_status, "rejected")
        self.assertEqual(listing.availability_status, "unavailable")

    def test_mark_sold_leaves_moderation_alone(self):
        listing = self.listing("approved", "available")
        listing.mark_sold()
        listing.refresh_from_db()
        self.assertEqual(listing.moderation_status, "approved")
        self.assertEqual(listing.availability_status, "sold")
        self.assertFalse(listing.is_published)

    def test_a_rejected_listing_cannot_be_sold(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                self.listing("rejected", "sold")

    def test_approval_stamps_published_at(self):
        listing = self.listing("pending_screening", "available")
        self.assertIsNone(listing.published_at)
        listing.approve()
        listing.refresh_from_db()
        self.assertEqual(listing.moderation_status, "approved")
        self.assertIsNotNone(listing.published_at)


class ListingSplitApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.seller = make_user("2024-555002@rtu.edu.ph")
        cls.moderator = make_user("mod2@rtu.edu.ph", role=User.Role.MODERATOR)
        cls.category = Category.objects.create(name="Jackets")

    def listing(self, title, moderation, availability):
        return Listing.objects.create(
            seller=self.seller,
            category=self.category,
            title=title,
            description="x",
            price="10.00",
            quantity=1,
            meetup_place="Gate",
            moderation_status=moderation,
            availability_status=availability,
        )

    def test_visitors_only_see_approved_and_available(self):
        from apps.catalog.models import Listing as L

        self.listing("On sale", "approved", "available")
        self.listing("Sold out", "approved", "sold")
        self.listing("Hidden", "pending_screening", "available")

        response = self.client.get("/api/v1/listings/")
        titles = [row["title"] for row in response.json()["results"]]
        self.assertEqual(titles, ["On sale"])

    def test_the_owner_still_sees_their_sold_listing(self):
        self.listing("Sold out", "approved", "sold")
        self.client.force_authenticate(self.seller)
        response = self.client.get("/api/v1/listings/")
        self.assertEqual([row["title"] for row in response.json()["results"]], ["Sold out"])

    def test_availability_can_be_filtered_directly(self):
        self.listing("Sold out", "approved", "sold")
        self.listing("On sale", "approved", "available")
        self.client.force_authenticate(self.moderator)
        response = self.client.get("/api/v1/listings/?availability_status=sold")
        self.assertEqual([row["title"] for row in response.json()["results"]], ["Sold out"])

    def test_the_legacy_status_parameter_still_selects_availability(self):
        self.listing("Sold out", "approved", "sold")
        self.listing("On sale", "approved", "available")
        self.client.force_authenticate(self.moderator)
        response = self.client.get("/api/v1/listings/?status=sold")
        self.assertEqual([row["title"] for row in response.json()["results"]], ["Sold out"])

    def test_the_payload_exposes_both_fields_and_the_derived_one(self):
        listing = self.listing("On sale", "approved", "sold")
        self.client.force_authenticate(self.seller)
        row = self.client.get(f"/api/v1/listings/{listing.slug}/").json()
        self.assertEqual(row["moderation_status"], "approved")
        self.assertEqual(row["availability_status"], "sold")
        self.assertEqual(row["status"], "sold")
