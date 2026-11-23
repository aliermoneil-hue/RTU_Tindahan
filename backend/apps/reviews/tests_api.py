"""API tests for buyer ratings on completed orders."""

from decimal import Decimal

from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.catalog.models import Category, Listing
from apps.orders.models import Order, OrderLine

from .models import Review


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
    data = response.json()
    if isinstance(data, dict):
        for value in data.values():
            if isinstance(value, list) and value:
                return str(value[0])
            if isinstance(value, str):
                return value
    return str(data)


def rows(response):
    """The list payload, paginated or not."""
    data = response.json()
    return data["results"] if isinstance(data, dict) and "results" in data else data


class ReviewApiTests(APITestCase):
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
        self.other_listing = Listing.objects.create(
            seller=self.seller,
            category=self.category,
            title="Ballpen Set",
            description="Three pens.",
            listing_type=Listing.Type.PRODUCT,
            condition=Listing.Condition.NEW,
            price=Decimal("50.00"),
            quantity=10,
            meetup_place="Main lobby",
            moderation_status=Listing.ModerationStatus.APPROVED,
            availability_status=Listing.AvailabilityStatus.AVAILABLE,
        )
        self.order = Order.objects.create(
            reference="ORD-261123-001",
            buyer=self.buyer,
            seller=self.seller,
            status=Order.Status.COMPLETED,
        )
        OrderLine.objects.create(
            order=self.order,
            listing=self.listing,
            title=self.listing.title,
            quantity=1,
            unit_price=self.listing.price,
        )

    def review(self, **payload):
        self.client.force_authenticate(self.buyer)
        body = {"order": self.order.reference, "stars": 5, "text": "Works great."}
        body.update(payload)
        return self.client.post("/api/v1/reviews/", body, format="json")

    def test_an_item_review_is_created_and_shaped_for_the_ui(self):
        response = self.review(listing=self.listing.pk)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        body = response.json()
        self.assertEqual(body["kind"], "item")
        self.assertEqual(body["listing_slug"], self.listing.slug)
        self.assertEqual(body["order"], self.order.reference)
        self.assertTrue(body["is_mine"])
        self.assertEqual(body["buyer_name"], "2024-222222")
        self.assertNotIn("buyer_email", body)
        self.assertEqual(Review.objects.filter(buyer=self.buyer).count(), 1)

    def test_a_seller_review_has_no_listing(self):
        response = self.review()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()["kind"], "seller")
        self.assertIsNone(response.json()["listing_id"])

    def test_editing_updates_the_same_row(self):
        first = self.review(listing=self.listing.pk)
        second = self.review(listing=self.listing.pk, stars=3, text="Changed my mind.")

        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(Review.objects.filter(buyer=self.buyer).count(), 1)
        self.assertEqual(Review.objects.get().stars, 3)
        self.assertTrue(second.json()["edited"])

    def test_one_seller_review_per_order(self):
        first = self.review()
        second = self.review(stars=4)

        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(Review.objects.filter(buyer=self.buyer, listing__isnull=True).count(), 1)

    def test_an_unfinished_order_cannot_be_rated(self):
        self.order.status = Order.Status.REQUESTED
        self.order.save(update_fields=["status"])

        response = self.review(listing=self.listing.pk)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("pickup is completed", error_text(response))
        self.assertFalse(Review.objects.exists())

    def test_someone_elses_order_cannot_be_rated(self):
        self.client.force_authenticate(self.stranger)
        response = self.client.post(
            "/api/v1/reviews/",
            {"order": self.order.reference, "stars": 5},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("your own order", error_text(response))
        self.assertFalse(Review.objects.exists())

    def test_a_listing_not_on_the_order_is_refused(self):
        response = self.review(listing=self.other_listing.pk)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("not part of this order", error_text(response))

    def test_stars_outside_one_to_five_are_refused(self):
        self.assertEqual(self.review(stars=0).status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.review(stars=6).status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Review.objects.exists())

    def test_the_list_is_public_and_filterable(self):
        self.review(listing=self.listing.pk)
        self.review()

        self.client.force_authenticate(None)
        all_reviews = self.client.get("/api/v1/reviews/")
        item_only = self.client.get(f"/api/v1/reviews/?listing={self.listing.pk}")
        by_seller = self.client.get(f"/api/v1/reviews/?seller={self.seller.email}")

        self.assertEqual(len(rows(all_reviews)), 2)
        self.assertEqual(len(rows(item_only)), 1)
        self.assertEqual(rows(item_only)[0]["kind"], "item")
        self.assertEqual(len(rows(by_seller)), 2)
        self.assertFalse(rows(item_only)[0]["is_mine"])

    def test_mine_returns_only_my_reviews(self):
        self.review(listing=self.listing.pk)
        self.review()

        self.client.force_authenticate(self.stranger)
        self.assertEqual(rows(self.client.get("/api/v1/reviews/?mine=1")), [])

        self.client.force_authenticate(self.buyer)
        self.assertEqual(len(rows(self.client.get("/api/v1/reviews/?mine=1"))), 2)

    def test_the_buyer_can_delete_their_review(self):
        review_id = self.review(listing=self.listing.pk).json()["id"]

        response = self.client.delete(f"/api/v1/reviews/{review_id}/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Review.objects.exists())

    def test_someone_else_cannot_delete_a_review(self):
        review_id = self.review(listing=self.listing.pk).json()["id"]

        self.client.force_authenticate(self.stranger)
        response = self.client.delete(f"/api/v1/reviews/{review_id}/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Review.objects.filter(pk=review_id).exists())

    def test_a_moderator_can_remove_a_review(self):
        review_id = self.review(listing=self.listing.pk).json()["id"]
        moderator = make_user("2024-444444@rtu.edu.ph", role=User.Role.MODERATOR)

        self.client.force_authenticate(moderator)
        response = self.client.delete(f"/api/v1/reviews/{review_id}/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Review.objects.exists())

    def test_the_listing_read_shape_carries_the_average(self):
        self.review(listing=self.listing.pk, stars=4)
        second_buyer = make_user("2024-555555@rtu.edu.ph")
        second_order = Order.objects.create(
            reference="ORD-261123-002",
            buyer=second_buyer,
            seller=self.seller,
            status=Order.Status.COMPLETED,
        )
        OrderLine.objects.create(
            order=second_order,
            listing=self.listing,
            title=self.listing.title,
            quantity=1,
            unit_price=self.listing.price,
        )
        self.client.force_authenticate(second_buyer)
        self.client.post(
            "/api/v1/reviews/",
            {"order": second_order.reference, "listing": self.listing.pk, "stars": 5},
            format="json",
        )

        self.client.force_authenticate(None)
        body = self.client.get(f"/api/v1/listings/{self.listing.slug}/").json()

        self.assertEqual(body["rating_count"], 2)
        self.assertEqual(body["rating_avg"], 4.5)
        page = self.client.get("/api/v1/listings/").json()["results"]
        row = next(item for item in page if item["slug"] == self.listing.slug)
        self.assertEqual(row["rating_count"], 2)
