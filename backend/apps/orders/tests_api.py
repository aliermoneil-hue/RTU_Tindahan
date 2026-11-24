"""API tests for student-to-student orders."""

from datetime import timedelta
from decimal import Decimal
from io import StringIO

from django.core.management import call_command
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.catalog.models import Category, Listing
from apps.notifications.models import Notification
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

    def test_completing_an_order_for_the_last_unit_succeeds(self):
        # The quantity column briefly required >= 1, so the last sale set it to
        # 0 inside the transaction and the database rejected the whole
        # completion with a 500. Zero must be a legal, sold-out stock level.
        self.listing.quantity = 1
        self.listing.save(update_fields=["quantity"])
        reference = self.request_order(1).json()["reference"]
        self.client.force_authenticate(self.seller)
        self.client.post(
            f"/api/v1/orders/{reference}/transition/", {"status": "accepted"}, format="json"
        )

        done = self.client.post(
            f"/api/v1/orders/{reference}/transition/", {"status": "completed"}, format="json"
        )

        self.assertEqual(done.status_code, status.HTTP_200_OK)
        self.listing.refresh_from_db()
        self.assertEqual(self.listing.quantity, 0)
        self.assertEqual(self.listing.availability_status, Listing.AvailabilityStatus.SOLD)
        self.assertEqual(self.listing.sold_count, 1)

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


class OrderContactVisibilityTests(APITestCase):
    """OT-07: a phone number reaches the other party only while Accepted."""

    def setUp(self):
        self.seller = make_user("2024-444444@rtu.edu.ph", contact_number="09998887777")
        self.buyer = make_user("2024-555555@rtu.edu.ph", contact_number="09171234567")
        self.stranger = make_user("2024-666666@rtu.edu.ph")
        self.category = Category.objects.create(name="Gadgets")
        self.listing = Listing.objects.create(
            seller=self.seller,
            category=self.category,
            title="Calculator",
            description="All keys working.",
            listing_type=Listing.Type.PRODUCT,
            condition=Listing.Condition.USED,
            price=Decimal("350.00"),
            quantity=2,
            meetup_place="Main lobby",
            moderation_status=Listing.ModerationStatus.APPROVED,
            availability_status=Listing.AvailabilityStatus.AVAILABLE,
        )
        self.client.force_authenticate(self.buyer)
        placed = self.client.post(
            "/api/v1/orders/",
            {
                "lines": [{"listing": self.listing.id, "quantity": 1}],
                "meetup_place": "Main lobby",
            },
            format="json",
        )
        self.assertEqual(placed.status_code, status.HTTP_201_CREATED, placed.json())
        self.reference = placed.json()["reference"]

    def read_as(self, user):
        self.client.force_authenticate(user)
        response = self.client.get(f"/api/v1/orders/{self.reference}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)
        return response.json()

    def accept(self):
        self.client.force_authenticate(self.seller)
        response = self.client.post(
            f"/api/v1/orders/{self.reference}/transition/",
            {"status": "accepted"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)

    def test_an_unanswered_request_shares_no_number(self):
        buyer_view = self.read_as(self.buyer)
        seller_view = self.read_as(self.seller)

        self.assertIsNone(buyer_view["seller_contact"])
        self.assertIsNone(seller_view["buyer_contact"])

    def test_an_accepted_order_shares_the_other_partys_number(self):
        self.accept()

        buyer_view = self.read_as(self.buyer)
        seller_view = self.read_as(self.seller)

        self.assertEqual(buyer_view["seller_contact"], "09998887777")
        self.assertEqual(seller_view["buyer_contact"], "09171234567")
        # Neither party is handed their own number back.
        self.assertIsNone(buyer_view["buyer_contact"])
        self.assertIsNone(seller_view["seller_contact"])

    def test_a_completed_order_stops_sharing(self):
        self.accept()
        self.client.force_authenticate(self.seller)
        done = self.client.post(
            f"/api/v1/orders/{self.reference}/transition/",
            {"status": "completed"},
            format="json",
        )
        self.assertEqual(done.status_code, status.HTTP_200_OK, done.content)

        self.assertIsNone(self.read_as(self.buyer)["seller_contact"])
        self.assertIsNone(self.read_as(self.seller)["buyer_contact"])

    def test_a_cancelled_order_stops_sharing(self):
        self.accept()
        self.client.force_authenticate(self.buyer)
        cancelled = self.client.post(
            f"/api/v1/orders/{self.reference}/transition/",
            {"status": "cancelled"},
            format="json",
        )
        self.assertEqual(cancelled.status_code, status.HTTP_200_OK, cancelled.content)

        self.assertIsNone(self.read_as(self.buyer)["seller_contact"])

    def test_a_stranger_cannot_read_the_order_at_all(self):
        self.accept()

        self.client.force_authenticate(self.stranger)
        response = self.client.get(f"/api/v1/orders/{self.reference}/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class SellerSalesHistoryTests(APITestCase):
    """SD-03 and SD-04: filtering and exporting a seller's own sales."""

    def setUp(self):
        self.seller = make_user("2024-888001@rtu.edu.ph")
        self.other_seller = make_user("2024-888002@rtu.edu.ph")
        self.buyer = make_user("2024-888003@rtu.edu.ph")
        self.category = Category.objects.create(name="Books")
        self.listing = Listing.objects.create(
            seller=self.seller,
            category=self.category,
            title="Statistics Textbook",
            description="No highlights.",
            listing_type=Listing.Type.PRODUCT,
            condition=Listing.Condition.USED,
            price=Decimal("250.00"),
            quantity=5,
            meetup_place="Main lobby",
            moderation_status=Listing.ModerationStatus.APPROVED,
            availability_status=Listing.AvailabilityStatus.AVAILABLE,
        )
        self.other_listing = Listing.objects.create(
            seller=self.other_seller,
            category=self.category,
            title="Someone else's book",
            description="Not mine.",
            listing_type=Listing.Type.PRODUCT,
            condition=Listing.Condition.USED,
            price=Decimal("100.00"),
            quantity=5,
            meetup_place="Main lobby",
            moderation_status=Listing.ModerationStatus.APPROVED,
            availability_status=Listing.AvailabilityStatus.AVAILABLE,
        )

    def place(self, listing, status_name, days_ago=0):
        self.client.force_authenticate(self.buyer)
        response = self.client.post(
            "/api/v1/orders/",
            {"lines": [{"listing": listing.id, "quantity": 1}], "meetup_place": "Main lobby"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.json())
        reference = response.json()["reference"]
        order = Order.objects.get(reference=reference)
        order.status = status_name
        order.save(update_fields=["status"])
        if days_ago:
            stamp = timezone.now() - timedelta(days=days_ago)
            Order.objects.filter(pk=order.pk).update(created_at=stamp, updated_at=stamp)
        return reference

    def seller_get(self, path):
        self.client.force_authenticate(self.seller)
        return self.client.get(path)

    def test_status_filter_returns_only_that_status(self):
        self.place(self.listing, Order.Status.COMPLETED)
        self.place(self.listing, Order.Status.REQUESTED)

        body = self.seller_get("/api/v1/orders/?role=seller&status=completed").json()

        rows = body["results"] if isinstance(body, dict) else body
        self.assertEqual([row["status"] for row in rows], ["completed"])

    def test_date_range_narrows_the_history(self):
        self.place(self.listing, Order.Status.COMPLETED, days_ago=40)
        self.place(self.listing, Order.Status.COMPLETED, days_ago=2)

        today = timezone.localdate()
        start = (today - timedelta(days=7)).isoformat()
        end = today.isoformat()
        body = self.seller_get(
            f"/api/v1/orders/?role=seller&status=completed&from={start}&to={end}"
        ).json()

        rows = body["results"] if isinstance(body, dict) else body
        self.assertEqual(len(rows), 1)

    def test_a_malformed_date_is_refused_in_plain_words(self):
        response = self.seller_get("/api/v1/orders/?role=seller&from=yesterday")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Use YYYY-MM-DD", str(response.json()))

    def test_export_returns_a_csv_of_the_sellers_own_rows_only(self):
        mine = self.place(self.listing, Order.Status.COMPLETED)
        self.place(self.other_listing, Order.Status.COMPLETED)

        response = self.seller_get("/api/v1/orders/export/?role=seller")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response["Content-Type"].startswith("text/csv"))
        self.assertIn("attachment; filename=\"tindahan-seller-sales-", response["Content-Disposition"])
        body = response.content.decode()
        self.assertIn("reference,placed_on,status,buyer,buyer_email,items,total", body)
        self.assertIn(mine, body)
        self.assertIn("Statistics Textbook x1", body)
        self.assertNotIn("Someone else's book", body)

    def test_export_honours_the_same_filters_as_the_list(self):
        self.place(self.listing, Order.Status.COMPLETED)
        self.place(self.listing, Order.Status.CANCELLED)

        response = self.seller_get("/api/v1/orders/export/?role=seller&status=cancelled")

        body = response.content.decode()
        self.assertIn(",cancelled,", body)
        self.assertNotIn(",completed,", body)

    def test_a_formula_in_a_title_cannot_run_in_the_spreadsheet(self):
        self.listing.title = "=HYPERLINK(\"http://example.com\")"
        self.listing.save(update_fields=["title"])
        self.place(self.listing, Order.Status.COMPLETED)

        response = self.seller_get("/api/v1/orders/export/?role=seller")

        body = response.content.decode()
        self.assertIn("'=HYPERLINK", body)


class PaymentMethodTests(APITestCase):
    """OT-06: the choice is recorded, and no money moves through the platform."""

    def setUp(self):
        self.seller = make_user("2024-999001@rtu.edu.ph")
        self.buyer = make_user("2024-999002@rtu.edu.ph")
        self.category = Category.objects.create(name="School supplies")
        self.listing = Listing.objects.create(
            seller=self.seller,
            category=self.category,
            title="Lab gown",
            description="Size M, used twice.",
            listing_type=Listing.Type.PRODUCT,
            condition=Listing.Condition.USED,
            price=Decimal("300.00"),
            quantity=2,
            meetup_place="Main lobby",
            moderation_status=Listing.ModerationStatus.APPROVED,
            availability_status=Listing.AvailabilityStatus.AVAILABLE,
        )

    def request_order(self, **extra):
        payload = {
            "lines": [{"listing": self.listing.id, "quantity": 1}],
            "fulfillment": "pickup",
            "meetup_place": "Main lobby",
        }
        payload.update(extra)
        self.client.force_authenticate(self.buyer)
        return self.client.post("/api/v1/orders/", payload, format="json")

    def test_cash_is_the_default_and_from_the_exchange(self):
        body = self.request_order().json()

        self.assertEqual(body["payment_method"], "cash")
        self.assertEqual(body["payment_method_display"], "Cash at the campus meet-up")

    def test_the_buyer_can_ask_for_a_person_to_person_transfer(self):
        body = self.request_order(payment_method="p2p").json()

        self.assertEqual(body["payment_method"], "p2p")
        self.assertEqual(
            body["payment_method_display"],
            "Person-to-person transfer (GCash, Maya or bank)",
        )

    def test_the_seller_can_agree_on_something_else_and_the_buyer_is_told(self):
        reference = self.request_order().json()["reference"]

        self.client.force_authenticate(self.seller)
        changed = self.client.post(
            f"/api/v1/orders/{reference}/payment/", {"method": "p2p"}, format="json"
        )

        self.assertEqual(changed.status_code, status.HTTP_200_OK, changed.json())
        self.assertEqual(changed.json()["payment_method"], "p2p")
        self.assertTrue(
            Notification.objects.filter(
                user=self.buyer, text__contains="Person-to-person transfer"
            ).exists()
        )

    def test_an_accepted_order_can_still_be_settled_either_way(self):
        reference = self.request_order().json()["reference"]
        self.client.force_authenticate(self.seller)
        self.client.post(
            f"/api/v1/orders/{reference}/transition/", {"status": "accepted"}, format="json"
        )

        self.client.force_authenticate(self.buyer)
        changed = self.client.post(
            f"/api/v1/orders/{reference}/payment/", {"method": "cash"}, format="json"
        )

        self.assertEqual(changed.status_code, status.HTTP_200_OK)
        self.assertEqual(changed.json()["payment_method"], "cash")

    def test_a_finished_order_keeps_the_method_it_was_settled_with(self):
        reference = self.request_order(payment_method="p2p").json()["reference"]
        self.client.force_authenticate(self.seller)
        self.client.post(
            f"/api/v1/orders/{reference}/transition/", {"status": "accepted"}, format="json"
        )
        self.client.post(
            f"/api/v1/orders/{reference}/transition/", {"status": "completed"}, format="json"
        )

        refused = self.client.post(
            f"/api/v1/orders/{reference}/payment/", {"method": "cash"}, format="json"
        )

        self.assertEqual(refused.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("stays as it was", str(refused.json()))

    def test_a_stranger_cannot_set_it(self):
        reference = self.request_order().json()["reference"]
        self.client.force_authenticate(make_user("2024-999003@rtu.edu.ph"))

        refused = self.client.post(
            f"/api/v1/orders/{reference}/payment/", {"method": "p2p"}, format="json"
        )

        self.assertEqual(refused.status_code, status.HTTP_404_NOT_FOUND)

    def test_anything_that_is_not_one_of_the_two_is_refused(self):
        reference = self.request_order().json()["reference"]
        self.client.force_authenticate(self.buyer)

        refused = self.client.post(
            f"/api/v1/orders/{reference}/payment/",
            {"method": "credit_card"},
            format="json",
        )

        self.assertEqual(refused.status_code, status.HTTP_400_BAD_REQUEST)


class RequestExpiryTests(APITestCase):
    """OT-12: an unanswered request cancels itself, and both parties hear about it."""

    def setUp(self):
        self.seller = make_user("2024-111001@rtu.edu.ph")
        self.buyer = make_user("2024-111002@rtu.edu.ph")
        self.category = Category.objects.create(name="Uniforms")
        self.listing = Listing.objects.create(
            seller=self.seller,
            category=self.category,
            title="PE shirt",
            description="Size L.",
            listing_type=Listing.Type.PRODUCT,
            condition=Listing.Condition.USED,
            price=Decimal("150.00"),
            quantity=3,
            meetup_place="Main lobby",
            moderation_status=Listing.ModerationStatus.APPROVED,
            availability_status=Listing.AvailabilityStatus.AVAILABLE,
        )

    def request_order(self):
        self.client.force_authenticate(self.buyer)
        response = self.client.post(
            "/api/v1/orders/",
            {
                "lines": [{"listing": self.listing.id, "quantity": 1}],
                "fulfillment": "pickup",
                "meetup_place": "Main lobby",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.json())
        return response.json()

    def age(self, reference, hours):
        stamp = timezone.now() - timedelta(hours=hours)
        Order.objects.filter(reference=reference).update(
            created_at=stamp, expires_at=stamp + timedelta(hours=48)
        )

    def test_a_new_request_carries_a_deadline_48_hours_out(self):
        body = self.request_order()

        self.assertIsNotNone(body["expires_at"])
        created = timezone.datetime.fromisoformat(body["created_at"].replace("Z", "+00:00"))
        expires = timezone.datetime.fromisoformat(body["expires_at"].replace("Z", "+00:00"))
        self.assertAlmostEqual((expires - created).total_seconds() / 3600, 48, delta=0.1)

    def test_a_request_past_its_deadline_is_cancelled_and_both_are_told(self):
        reference = self.request_order()["reference"]
        self.age(reference, hours=49)

        self.client.force_authenticate(self.buyer)
        body = self.client.get(f"/api/v1/orders/{reference}/").json()

        self.assertEqual(body["status"], "cancelled")
        self.assertTrue(
            Notification.objects.filter(
                user=self.buyer, text__contains="expired"
            ).exists()
        )
        self.assertTrue(
            Notification.objects.filter(
                user=self.seller, text__contains="expired unanswered"
            ).exists()
        )

    def test_a_request_inside_the_window_is_left_alone(self):
        reference = self.request_order()["reference"]
        self.age(reference, hours=47)

        self.client.force_authenticate(self.buyer)
        body = self.client.get(f"/api/v1/orders/{reference}/").json()

        self.assertEqual(body["status"], "requested")

    def test_an_accepted_order_is_never_swept(self):
        reference = self.request_order()["reference"]
        self.client.force_authenticate(self.seller)
        self.client.post(
            f"/api/v1/orders/{reference}/transition/", {"status": "accepted"}, format="json"
        )
        self.age(reference, hours=200)

        self.client.force_authenticate(self.seller)
        body = self.client.get(f"/api/v1/orders/{reference}/").json()

        self.assertEqual(body["status"], "accepted")

    def test_the_sweep_is_idempotent_and_notifies_once(self):
        reference = self.request_order()["reference"]
        self.age(reference, hours=60)

        self.client.force_authenticate(self.buyer)
        self.client.get("/api/v1/orders/")
        self.client.get("/api/v1/orders/")

        self.assertEqual(
            Notification.objects.filter(user=self.buyer, text__contains="expired").count(), 1
        )

    def test_the_command_reports_and_cancels(self):
        reference = self.request_order()["reference"]
        self.age(reference, hours=49)

        out = StringIO()
        call_command("expire_order_requests", stdout=out)

        self.assertIn("cancelled 1 unanswered request", out.getvalue())
        self.assertEqual(Order.objects.get(reference=reference).status, "cancelled")

    def test_the_command_can_be_asked_without_changing_anything(self):
        reference = self.request_order()["reference"]
        self.age(reference, hours=49)

        out = StringIO()
        call_command("expire_order_requests", "--dry-run", stdout=out)

        self.assertIn("would cancel 1 request", out.getvalue())
        self.assertEqual(Order.objects.get(reference=reference).status, "requested")

    @override_settings(ORDER_REQUEST_TTL_HOURS=0)
    def test_a_zero_clock_means_requests_never_expire(self):
        body = self.request_order()

        self.assertIsNone(body["expires_at"])
        out = StringIO()
        call_command("expire_order_requests", stdout=out)
        self.assertIn("never expire", out.getvalue())
