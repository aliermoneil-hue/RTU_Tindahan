"""API tests for saved listings and saved sellers."""

from decimal import Decimal

from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.catalog.models import Category, Listing

from .models import Favorite


def make_user(email, **extra):
    user = User.objects.create_user(
        email=email,
        display_name=email.split("@")[0],
        password="SecurePass123!",
        member_type=User.MemberType.STUDENT,
        college="College of ICT",
        year_level=2,
        **extra,
    )
    user.verify()
    return user


def error_text(response):
    """The first readable message, however DRF wrapped it."""
    data = response.json()
    if isinstance(data, dict):
        for value in data.values():
            if isinstance(value, list) and value:
                return str(value[0])
            if isinstance(value, str):
                return value
    return str(data)


class FavoriteApiTests(APITestCase):
    def setUp(self):
        self.seller = make_user("2024-111111@rtu.edu.ph")
        self.buyer = make_user("2024-222222@rtu.edu.ph")
        self.stranger = make_user("2024-333333@rtu.edu.ph")
        self.category = Category.objects.create(name="Gadgets")
        self.listing = Listing.objects.create(
            seller=self.seller,
            category=self.category,
            title="Secondhand Calculator",
            description="All keys working.",
            listing_type=Listing.Type.PRODUCT,
            condition=Listing.Condition.USED,
            price=Decimal("350.00"),
            quantity=3,
            meetup_place="Main lobby",
            moderation_status=Listing.ModerationStatus.APPROVED,
            availability_status=Listing.AvailabilityStatus.AVAILABLE,
        )

    def toggle(self, **payload):
        self.client.force_authenticate(self.buyer)
        return self.client.post("/api/v1/favorites/toggle/", payload, format="json")

    def test_saving_a_listing_returns_the_slug_and_marks_it_saved(self):
        response = self.toggle(listing=self.listing.pk)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        body = response.json()
        self.assertTrue(body["saved"])
        self.assertEqual(body["favorite"]["kind"], "listing")
        self.assertEqual(body["favorite"]["listing_slug"], self.listing.slug)
        self.assertEqual(Favorite.objects.filter(user=self.buyer).count(), 1)

        listing = self.client.get("/api/v1/favorites/")
        self.assertEqual(len(listing.json()), 1)
        self.assertEqual(listing.json()[0]["listing_id"], self.listing.pk)

    def test_toggling_the_same_listing_again_removes_it(self):
        self.toggle(listing=self.listing.pk)
        response = self.toggle(listing=self.listing.pk)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.json()["saved"])
        self.assertFalse(Favorite.objects.filter(user=self.buyer).exists())

    def test_a_seller_is_saved_by_email(self):
        response = self.toggle(seller=self.seller.email)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()["favorite"]["kind"], "seller")
        self.assertEqual(response.json()["favorite"]["seller_email"], self.seller.email)

        response = self.toggle(seller=self.seller.email)
        self.assertFalse(response.json()["saved"])

    def test_list_is_private(self):
        self.toggle(listing=self.listing.pk)

        self.client.force_authenticate(self.stranger)
        response = self.client.get("/api/v1/favorites/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), [])

    def test_another_members_row_cannot_be_deleted(self):
        self.toggle(listing=self.listing.pk)
        favorite = Favorite.objects.get(user=self.buyer)

        self.client.force_authenticate(self.stranger)
        response = self.client.delete(f"/api/v1/favorites/{favorite.pk}/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(Favorite.objects.filter(pk=favorite.pk).exists())

    def test_own_listing_is_refused(self):
        self.client.force_authenticate(self.seller)
        response = self.client.post(
            "/api/v1/favorites/toggle/", {"listing": self.listing.pk}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("own listing", error_text(response))

    def test_own_shop_is_refused(self):
        response = self.toggle(seller=self.buyer.email)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("own shop", error_text(response))

    def test_an_unpublished_listing_cannot_be_saved(self):
        self.listing.moderation_status = Listing.ModerationStatus.PENDING_SCREENING
        self.listing.save(update_fields=["moderation_status"])

        response = self.toggle(listing=self.listing.pk)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("not available", error_text(response))
        self.assertFalse(Favorite.objects.filter(user=self.buyer).exists())

    def test_exactly_one_target_is_required(self):
        response = self.toggle()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        response = self.toggle(listing=self.listing.pk, seller=self.seller.email)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_an_unverified_member_cannot_save(self):
        unverified = User.objects.create_user(
            email="2024-444444@rtu.edu.ph",
            display_name="unverified",
            password="SecurePass123!",
            member_type=User.MemberType.STUDENT,
            college="College of ICT",
            year_level=1,
        )

        self.client.force_authenticate(unverified)
        response = self.client.post(
            "/api/v1/favorites/toggle/", {"listing": self.listing.pk}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(Favorite.objects.exists())

    def test_deleting_a_listing_removes_its_favorites(self):
        self.toggle(listing=self.listing.pk)

        self.listing.delete()

        self.assertFalse(Favorite.objects.filter(user=self.buyer).exists())
