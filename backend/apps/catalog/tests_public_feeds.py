"""The two public read-only endpoints the hero carousel and the landing page use.

Lian's branch added `GET /api/v1/top-selling/` and `GET /api/v1/stats/` for
visitors who are not signed in. Both were written against the catalogue's old
single `status` column, which migration 0003 split into `moderation_status` and
`availability_status` — so both raised AttributeError and Django answered 500.
These tests pin the rule they are supposed to express: published AND still
available, from an active seller, and nothing that is not.
"""

from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.catalog.models import Category, Listing, ListingPhoto
from apps.store.models import OfficialTicket


def make_user(email, role=User.Role.USER, **extra):
    user = User.objects.create_user(
        email=email,
        display_name=email.split("@")[0],
        password="SecurePass123!",
        member_type=User.MemberType.STUDENT,
        college="College of ICT",
        year_level=2,
        **extra,
    )
    user.role = role
    user.verify()
    return user


@override_settings(SCREENING_PROVIDER="stub", SCREENING_IMAGES="off")
class PublicFeedsTests(APITestCase):
    def setUp(self):
        self.category = Category.objects.create(name="School Supplies")
        self.seller = make_user("2024-400001@rtu.edu.ph")

    def make_listing(self, **overrides):
        data = {
            "seller": self.seller,
            "category": self.category,
            "title": "Ballpen",
            "description": "Blue ballpen.",
            "listing_type": Listing.Type.PRODUCT,
            "condition": Listing.Condition.NEW,
            "price": "10.00",
            "quantity": 1,
            "meetup_place": "Library",
            "moderation_status": Listing.ModerationStatus.APPROVED,
            "availability_status": Listing.AvailabilityStatus.AVAILABLE,
        }
        data.update(overrides)
        return Listing.objects.create(**data)

    # -- /top-selling/ ------------------------------------------------------

    def test_a_visitor_can_read_the_carousel_without_signing_in(self):
        self.make_listing(title="Ballpen")
        response = self.client.get("/api/v1/top-selling/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([row["title"] for row in response.json()], ["Ballpen"])

    def test_unpublished_or_sold_items_stay_out_of_the_carousel(self):
        self.make_listing(title="Live")
        self.make_listing(
            title="Waiting", moderation_status=Listing.ModerationStatus.PENDING_SCREENING
        )
        self.make_listing(
            title="Sold out", availability_status=Listing.AvailabilityStatus.SOLD
        )
        self.make_listing(
            title="Rejected", moderation_status=Listing.ModerationStatus.REJECTED
        )
        titles = [row["title"] for row in self.client.get("/api/v1/top-selling/").json()]
        self.assertEqual(titles, ["Live"])

    def test_a_suspended_sellers_listing_stays_out(self):
        self.make_listing(title="Live")
        self.make_listing(
            title="From a suspended seller",
            seller=make_user("2024-400002@rtu.edu.ph", status="suspended"),
        )
        titles = [row["title"] for row in self.client.get("/api/v1/top-selling/").json()]
        self.assertEqual(titles, ["Live"])

    def test_the_carousel_photo_is_a_relative_media_path(self):
        """An absolute URL would freeze one tunnel hostname into the carousel."""
        listing = self.make_listing()
        ListingPhoto.objects.filter(listing=listing).delete()
        ListingPhoto.objects.create(listing=listing, image="listings/probe.jpg")
        row = self.client.get("/api/v1/top-selling/").json()[0]
        self.assertTrue(row["image_url"].startswith("/media/"), row["image_url"])
        self.assertNotIn("http", row["image_url"])

    def test_the_carousel_is_capped_at_five_rows(self):
        for index in range(7):
            self.make_listing(title=f"Item {index}")
        self.assertEqual(len(self.client.get("/api/v1/top-selling/").json()), 5)

    # -- /stats/ ------------------------------------------------------------

    def test_the_landing_page_numbers_are_public_and_counted_the_same_way(self):
        self.make_listing(title="Live")
        self.make_listing(
            title="Waiting", moderation_status=Listing.ModerationStatus.PENDING_SCREENING
        )
        self.make_listing(
            title="Sold out", availability_status=Listing.AvailabilityStatus.SOLD
        )
        buyer = make_user("2024-400003@rtu.edu.ph")
        OfficialTicket.objects.create(buyer=buyer, pickup_date="2026-12-01")
        OfficialTicket.objects.create(
            buyer=buyer, pickup_date="2026-12-01", status=OfficialTicket.Status.CLAIMED
        )

        response = self.client.get("/api/v1/stats/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.json(), {"listings_on_sale": 1, "completed_pickups": 1}
        )
