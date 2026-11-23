"""API tests for the Official Store: tickets, stock, counts, and settings."""

from decimal import Decimal

from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.catalog.models import Category, Listing, ListingVariant
from apps.store.models import OfficialTicket, StockMovement, StoreSetting
from apps.store.services import record_stock_in


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


class StoreApiTestCase(APITestCase):
    def setUp(self):
        self.staff = make_user("staff@rtu.edu.ph", role=User.Role.OFFICE_STAFF)
        self.student = make_user("2024-123456@rtu.edu.ph")
        self.other = make_user("2024-654321@rtu.edu.ph")

        category = Category.objects.create(name="Uniforms")
        self.listing = Listing.objects.create(
            seller=self.staff,
            category=category,
            title="Official Uniform",
            description="RTU uniform.",
            listing_type=Listing.Type.PRODUCT,
            condition=Listing.Condition.NEW,
            price=Decimal("500.00"),
            quantity=1,
            meetup_place="OSA Office",
            is_official=True,
        )
        self.variant = ListingVariant.objects.create(
            listing=self.listing, name="Medium", on_hand=0, available=0
        )
        record_stock_in(self.variant, 10, by=self.staff)

    def order(self, quantity=3):
        self.client.force_authenticate(self.student)
        return self.client.post(
            "/api/v1/store/tickets/",
            {
                "items": [
                    {
                        "listing": self.listing.pk,
                        "variant": self.variant.pk,
                        "quantity": quantity,
                    }
                ]
            },
            format="json",
        )


class TicketApiTests(StoreApiTestCase):
    def test_a_verified_student_places_a_request(self):
        response = self.order(3)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertRegex(response.json()["reference"], r"^TXN-\d{6}-\d{3}$")
        self.assertEqual(response.json()["status"], "request_received")
        self.assertEqual(Decimal(response.json()["total_amount"]), Decimal("1500.00"))

        self.variant.refresh_from_db()
        self.assertEqual(self.variant.available, 7)
        self.assertEqual(self.variant.reserved, 3)

    # -- face to face: office staff recording a walk-in request ------------

    def staff_order_for(self, email, quantity=1):
        self.client.force_authenticate(self.staff)
        return self.client.post(
            "/api/v1/store/tickets/",
            {
                "buyer_email": email,
                "items": [
                    {
                        "listing": self.listing.pk,
                        "variant": self.variant.pk,
                        "quantity": quantity,
                    }
                ],
            },
            format="json",
        )

    def test_office_staff_can_record_a_walk_in_request_for_a_student(self):
        response = self.staff_order_for(self.student.email, 2)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        ticket = OfficialTicket.objects.get(reference=response.json()["reference"])
        self.assertEqual(ticket.buyer, self.student)
        self.assertEqual(ticket.status, OfficialTicket.Status.REQUEST_RECEIVED)

        self.variant.refresh_from_db()
        self.assertEqual(self.variant.reserved, 2)

    def test_an_unknown_buyer_email_is_reported(self):
        response = self.staff_order_for("nobody@rtu.edu.ph")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("buyer_email", response.json())
        self.assertEqual(OfficialTicket.objects.count(), 0)

    def test_an_unverified_buyer_cannot_be_ordered_for(self):
        unverified = User.objects.create_user(
            email="2024-999999@rtu.edu.ph",
            display_name="Unverified",
            password="SecurePass123!",
            member_type=User.MemberType.STUDENT,
            college="College of ICT",
            year_level=1,
        )

        response = self.staff_order_for(unverified.email)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(OfficialTicket.objects.count(), 0)

    def test_a_student_cannot_name_another_buyer(self):
        self.client.force_authenticate(self.student)
        response = self.client.post(
            "/api/v1/store/tickets/",
            {
                "buyer_email": self.other.email,
                "items": [
                    {
                        "listing": self.listing.pk,
                        "variant": self.variant.pk,
                        "quantity": 1,
                    }
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("buyer_email", response.json())
        self.assertEqual(OfficialTicket.objects.count(), 0)

    def test_a_blank_buyer_email_still_orders_for_the_caller(self):
        self.client.force_authenticate(self.student)
        response = self.client.post(
            "/api/v1/store/tickets/",
            {
                "buyer_email": "",
                "items": [
                    {
                        "listing": self.listing.pk,
                        "variant": self.variant.pk,
                        "quantity": 1,
                    }
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            OfficialTicket.objects.get().buyer,
            self.student,
        )

    def test_ordering_more_than_is_available_returns_400_not_500(self):
        response = self.order(11)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", response.json())
        self.assertEqual(OfficialTicket.objects.count(), 0)

    def test_a_student_only_sees_their_own_tickets(self):
        self.order(1)

        self.client.force_authenticate(self.other)
        response = self.client.get("/api/v1/store/tickets/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["results"], [])

    def test_staff_sees_every_ticket(self):
        self.order(1)

        self.client.force_authenticate(self.staff)
        response = self.client.get("/api/v1/store/tickets/")

        self.assertEqual(len(response.json()["results"]), 1)

    def test_only_staff_may_advance_a_ticket(self):
        reference = self.order(1).json()["reference"]

        self.client.force_authenticate(self.student)
        refused = self.client.post(
            f"/api/v1/store/tickets/{reference}/transition/",
            {"status": "confirmed"},
            format="json",
        )
        self.assertEqual(refused.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.staff)
        allowed = self.client.post(
            f"/api/v1/store/tickets/{reference}/transition/",
            {"status": "confirmed"},
            format="json",
        )

        self.assertEqual(allowed.status_code, status.HTTP_200_OK)
        self.assertEqual(allowed.json()["status"], "confirmed")

    def test_a_student_can_cancel_their_own_request_and_stock_returns(self):
        reference = self.order(2).json()["reference"]
        self.client.force_authenticate(self.student)

        response = self.client.post(
            f"/api/v1/store/tickets/{reference}/transition/",
            {"status": "cancelled", "note": "Changed my mind"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.available, 10)
        self.assertEqual(self.variant.reserved, 0)

    def test_claiming_a_ticket_counts_the_sale(self):
        reference = self.order(3).json()["reference"]
        self.client.force_authenticate(self.staff)

        for next_status in ("confirmed", "ready_for_pickup", "claimed"):
            response = self.client.post(
                f"/api/v1/store/tickets/{reference}/transition/",
                {"status": next_status},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.listing.refresh_from_db()
        self.assertEqual(self.listing.sold_count, 3)

    def test_cancelling_a_ticket_does_not_count_a_sale(self):
        reference = self.order(2).json()["reference"]
        self.client.force_authenticate(self.student)

        self.client.post(
            f"/api/v1/store/tickets/{reference}/transition/",
            {"status": "cancelled", "note": "Changed my mind"},
            format="json",
        )

        self.listing.refresh_from_db()
        self.assertEqual(self.listing.sold_count, 0)

    def test_a_student_cannot_cancel_someone_elses_request(self):
        reference = self.order(1).json()["reference"]
        self.client.force_authenticate(self.other)

        response = self.client.post(
            f"/api/v1/store/tickets/{reference}/transition/",
            {"status": "cancelled", "note": "Not mine"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class StockApiTests(StoreApiTestCase):
    def test_a_student_cannot_add_stock(self):
        self.client.force_authenticate(self.student)

        response = self.client.post(
            "/api/v1/store/stock-in/",
            {"variant": self.variant.pk, "quantity": 5},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.on_hand, 10)

    def test_staff_stock_in_writes_a_ledger_entry(self):
        self.client.force_authenticate(self.staff)

        response = self.client.post(
            "/api/v1/store/stock-in/",
            {"variant": self.variant.pk, "quantity": 5, "reason": "New delivery"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()["variant"]["on_hand"], 15)
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.on_hand, 15)
        self.assertEqual(
            StockMovement.objects.filter(kind=StockMovement.Kind.STOCK_IN).count(), 2
        )

    def test_the_ledger_is_read_only_and_staff_only(self):
        self.client.force_authenticate(self.staff)
        response = self.client.get("/api/v1/store/stock/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.json()["results"]), 1)

        self.client.force_authenticate(self.student)
        hidden = self.client.get("/api/v1/store/stock/")
        self.assertEqual(hidden.status_code, status.HTTP_403_FORBIDDEN)

    def test_daily_count_needs_a_reason_when_the_count_differs(self):
        self.client.force_authenticate(self.staff)
        url = "/api/v1/store/daily-counts/"

        missing = self.client.post(
            url, {"variant": self.variant.pk, "counted_quantity": 8}, format="json"
        )
        given = self.client.post(
            url,
            {
                "variant": self.variant.pk,
                "counted_quantity": 8,
                "reason": "Two units missing",
            },
            format="json",
        )

        self.assertEqual(missing.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(given.status_code, status.HTTP_201_CREATED)
        self.assertEqual(given.json()["difference"], -2)
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.on_hand, 8)


class StoreSettingApiTests(StoreApiTestCase):
    # -- the policy the staff screen writes is the policy that is enforced --

    def test_the_per_student_limit_blocks_an_order(self):
        setting = StoreSetting.get_solo()
        setting.max_quantity_per_student = 2
        setting.save()

        response = self.order(3)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("per student", response.text)
        self.assertEqual(OfficialTicket.objects.count(), 0)

    def test_the_per_student_limit_counts_open_tickets(self):
        setting = StoreSetting.get_solo()
        setting.max_quantity_per_student = 3
        setting.save()
        self.assertEqual(self.order(2).status_code, status.HTTP_201_CREATED)

        second = self.order(2)

        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("per student", second.text)
        self.assertEqual(OfficialTicket.objects.count(), 1)

    def test_the_ordering_window_closes_the_store(self):
        from datetime import timedelta

        from django.utils import timezone

        # A window that cannot contain "now": whether the clock is near midnight
        # or not, start > now or end < now, so the store reads as closed.
        now = timezone.localtime()
        setting = StoreSetting.get_solo()
        setting.ordering_window_enabled = True
        setting.ordering_window_start = (now + timedelta(hours=12)).time().replace(
            microsecond=0
        )
        setting.ordering_window_end = (now + timedelta(hours=13)).time().replace(
            microsecond=0
        )
        setting.save()

        response = self.order(1)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("closed", response.text.lower())

    def test_a_window_that_is_open_lets_the_order_through(self):
        from datetime import time as clock

        setting = StoreSetting.get_solo()
        setting.ordering_window_enabled = True
        setting.ordering_window_start = clock(0, 0, 0)
        setting.ordering_window_end = clock(23, 59, 59)
        setting.save()

        response = self.order(1)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_anyone_can_read_the_policy(self):
        response = self.client.get("/api/v1/store/settings/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["max_quantity_per_ticket"], 10)

    def test_only_staff_may_change_the_policy(self):
        self.client.force_authenticate(self.student)
        refused = self.client.patch(
            "/api/v1/store/settings/", {"max_quantity_per_ticket": 5}, format="json"
        )
        self.assertEqual(refused.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.staff)
        allowed = self.client.patch(
            "/api/v1/store/settings/", {"max_quantity_per_ticket": 5}, format="json"
        )

        self.assertEqual(allowed.status_code, status.HTTP_200_OK)
        self.assertEqual(StoreSetting.get_solo().max_quantity_per_ticket, 5)


class WalkInSaleApiTests(StoreApiTestCase):
    """A face-to-face sale at the window: no ticket, real ledger rows."""

    def sell(self, quantity=2, reason=""):
        self.client.force_authenticate(self.staff)
        payload = {
            "items": [{"variant": self.variant.pk, "quantity": quantity}],
        }
        if reason:
            payload["reason"] = reason
        return self.client.post("/api/v1/store/sales/", payload, format="json")

    def test_a_cashier_records_a_sale_and_stock_moves(self):
        self.listing.refresh_from_db()
        before = self.listing.sold_count

        response = self.sell(2)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.on_hand, 8)
        self.assertEqual(self.variant.available, 8)
        self.listing.refresh_from_db()
        self.assertEqual(self.listing.sold_count, before + 2)
        self.assertTrue(
            StockMovement.objects.filter(
                kind=StockMovement.Kind.SOLD,
                variant=self.variant,
                quantity=2,
            ).exists()
        )

    def test_selling_more_than_is_available_changes_nothing(self):
        self.listing.refresh_from_db()
        before = self.listing.sold_count

        response = self.sell(99)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.on_hand, 10)
        self.assertEqual(self.variant.available, 10)
        self.listing.refresh_from_db()
        self.assertEqual(self.listing.sold_count, before)
        self.assertFalse(
            StockMovement.objects.filter(kind=StockMovement.Kind.SOLD).exists()
        )

    def test_only_office_staff_may_record_a_sale(self):
        self.client.force_authenticate(self.student)

        response = self.client.post(
            "/api/v1/store/sales/",
            {"items": [{"variant": self.variant.pk, "quantity": 1}]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_a_size_cannot_appear_twice_in_one_sale(self):
        self.client.force_authenticate(self.staff)

        response = self.client.post(
            "/api/v1/store/sales/",
            {
                "items": [
                    {"variant": self.variant.pk, "quantity": 1},
                    {"variant": self.variant.pk, "quantity": 2},
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.on_hand, 10)

    def test_a_zero_quantity_is_refused(self):
        response = self.sell(0)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
