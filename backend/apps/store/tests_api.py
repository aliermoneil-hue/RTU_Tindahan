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
