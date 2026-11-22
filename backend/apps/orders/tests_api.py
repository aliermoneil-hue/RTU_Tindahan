"""API tests for student-to-student orders."""

from decimal import Decimal

from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.catalog.models import Category, Listing
from apps.orders.models import Order


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


class OrderApiTests(APITestCase):
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

    def request_order(self, quantity=1, listing=None, **extra):
        self.client.force_authenticate(self.buyer)
        payload = {
            "lines": [{"listing": (listing or self.listing).pk, "quantity": quantity}],
            "fulfillment": "pickup",
            "meetup_place": "Main lobby",
            "meetup_time": "12:00",
            "note": "See you at noon.",
        }
        payload.update(extra)
        return self.client.post("/api/v1/orders/", payload, format="json")

    def test_a_request_lands_on_the_seller_side(self):
        response = self.request_order(2)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        body = response.json()
        self.assertRegex(body["reference"], r"^ORD-\d{6}-\d{3}$")
        self.assertEqual(body["status"], "requested")
        self.assertEqual(Decimal(body["total_amount"]), Decimal("700.00"))
        self.assertEqual(body["seller_email"], self.seller.email)

        self.client.force_authenticate(self.seller)
        sold = self.client.get("/api/v1/orders/?role=seller")

        self.assertEqual(sold.json()["count"], 1)
        self.assertEqual(sold.json()["results"][0]["reference"], body["reference"])

        self.client.force_authenticate(self.buyer)
        bought = self.client.get("/api/v1/orders/?role=buyer")
        self.assertEqual(bought.json()["count"], 1)

    def test_a_stranger_sees_no_orders(self):
        self.request_order()

        self.client.force_authenticate(self.stranger)
        response = self.client.get("/api/v1/orders/")

        self.assertEqual(response.json()["count"], 0)

    def test_a_seller_cannot_request_their_own_listing(self):
        self.client.force_authenticate(self.seller)
        response = self.client.post(
            "/api/v1/orders/",
            {"lines": [{"listing": self.listing.pk, "quantity": 1}]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Order.objects.count(), 0)

    def test_an_unapproved_listing_cannot_be_requested(self):
        self.listing.moderation_status = Listing.ModerationStatus.PENDING_SCREENING
        self.listing.save(update_fields=["moderation_status"])

        response = self.request_order()

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Order.objects.count(), 0)

    def test_more_than_the_stock_is_refused(self):
        response = self.request_order(4)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Order.objects.count(), 0)

    def test_lines_from_two_sellers_are_refused(self):
        other = make_user("2024-444444@rtu.edu.ph")
        second = Listing.objects.create(
            seller=other,
            category=self.category,
            title="Ruler",
            description="30 cm.",
            listing_type=Listing.Type.PRODUCT,
            condition=Listing.Condition.NEW,
            price=Decimal("20.00"),
            quantity=5,
            meetup_place="Main lobby",
            moderation_status=Listing.ModerationStatus.APPROVED,
            availability_status=Listing.AvailabilityStatus.AVAILABLE,
        )
        self.client.force_authenticate(self.buyer)
        response = self.client.post(
            "/api/v1/orders/",
            {
                "lines": [
                    {"listing": self.listing.pk, "quantity": 1},
                    {"listing": second.pk, "quantity": 1},
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_only_the_seller_can_accept(self):
        reference = self.request_order().json()["reference"]

        self.client.force_authenticate(self.buyer)
        refused = self.client.post(
            f"/api/v1/orders/{reference}/transition/", {"status": "accepted"}, format="json"
        )
        self.assertEqual(refused.status_code, status.HTTP_400_BAD_REQUEST)

        self.client.force_authenticate(self.seller)
        accepted = self.client.post(
            f"/api/v1/orders/{reference}/transition/", {"status": "accepted"}, format="json"
        )
        self.assertEqual(accepted.status_code, status.HTTP_200_OK)
        self.assertEqual(accepted.json()["status"], "accepted")

    def test_completing_an_order_moves_the_stock(self):
        reference = self.request_order(2).json()["reference"]
        self.client.force_authenticate(self.seller)
        self.client.post(
            f"/api/v1/orders/{reference}/transition/", {"status": "accepted"}, format="json"
        )

        done = self.client.post(
            f"/api/v1/orders/{reference}/transition/", {"status": "completed"}, format="json"
        )

        self.assertEqual(done.status_code, status.HTTP_200_OK)
        self.listing.refresh_from_db()
        self.assertEqual(self.listing.quantity, 1)
        self.assertEqual(self.listing.sold_count, 2)

    def test_the_buyer_can_cancel_but_not_after_completion(self):
        reference = self.request_order().json()["reference"]
        self.client.force_authenticate(self.buyer)

        cancelled = self.client.post(
            f"/api/v1/orders/{reference}/transition/", {"status": "cancelled"}, format="json"
        )
        self.assertEqual(cancelled.status_code, status.HTTP_200_OK)
        self.assertEqual(cancelled.json()["status"], "cancelled")

        again = self.client.post(
            f"/api/v1/orders/{reference}/transition/", {"status": "cancelled"}, format="json"
        )
        self.assertEqual(again.status_code, status.HTTP_400_BAD_REQUEST)

    def test_a_signed_out_visitor_cannot_order(self):
        self.client.force_authenticate(None)
        response = self.client.post(
            "/api/v1/orders/",
            {"lines": [{"listing": self.listing.pk, "quantity": 1}]},
            format="json",
        )

        self.assertIn(
            response.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )
