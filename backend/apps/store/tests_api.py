"""API tests for the Official Store: tickets, stock, counts, and settings."""

import json
from decimal import Decimal

from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.catalog.models import Category, Listing, ListingVariant
from apps.store.models import EmailOutbox, OfficialTicket, StockMovement, StoreSetting
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


class EmailOutboxApiTests(APITestCase):
    """EM-06: staff read the outbox, preview a message, and export it as JSON."""

    def setUp(self):
        self.staff = make_user("staff-outbox@rtu.edu.ph", role=User.Role.OFFICE_STAFF)
        self.student = make_user("2024-770010@rtu.edu.ph")
        self.moderator = make_user("mod-outbox@rtu.edu.ph", role=User.Role.MODERATOR)
        self.message = EmailOutbox.objects.create(
            kind=EmailOutbox.Kind.STUDENT,
            event="ready_for_pickup",
            recipients=["2024-770010@rtu.edu.ph"],
            subject="Your RTU Store order ORD-261124-001 is ready",
            body="Reference ORD-261124-001\nQueue number 012\nStatus Ready for Pickup\n"
            "Items: Official Uniform (M) x1\nPickup date: 2026-11-26\n"
            "This message is automatic.",
            note="",
        )
        EmailOutbox.objects.create(
            kind=EmailOutbox.Kind.STAFF,
            event="low_stock",
            recipients=[],
            subject="Low stock: Official Uniform (M)",
            body="On hand 2, threshold 3.",
            state=EmailOutbox.State.SKIPPED,
            note="No staff address is set.",
        )

    def test_staff_read_the_outbox(self):
        self.client.force_authenticate(self.staff)

        rows = self.client.get("/api/v1/store/outbox/").json()

        self.assertEqual(rows["count"], 2)
        first = rows["results"][0]
        self.assertIn("subject", first)
        self.assertIn("body", first)
        self.assertIn("kind_display", first)

    def test_one_message_can_be_previewed_in_full(self):
        self.client.force_authenticate(self.staff)

        one = self.client.get(f"/api/v1/store/outbox/{self.message.pk}/")

        self.assertEqual(one.status_code, status.HTTP_200_OK)
        body = one.json()["body"]
        self.assertIn("ORD-261124-001", body)
        self.assertIn("Queue number 012", body)
        self.assertIn("automatic", body)

    def test_a_student_cannot_read_it(self):
        self.client.force_authenticate(self.student)

        refused = self.client.get("/api/v1/store/outbox/")

        self.assertEqual(refused.status_code, status.HTTP_403_FORBIDDEN)

    def test_the_list_can_be_narrowed_by_kind_and_state(self):
        self.client.force_authenticate(self.staff)

        students = self.client.get("/api/v1/store/outbox/?kind=student").json()
        skipped = self.client.get("/api/v1/store/outbox/?state=skipped").json()

        self.assertEqual(students["count"], 1)
        self.assertEqual(students["results"][0]["ticket_reference"], None)
        self.assertEqual(skipped["count"], 1)
        self.assertEqual(skipped["results"][0]["state"], "skipped")

    def test_the_export_is_a_json_file_with_every_message(self):
        self.client.force_authenticate(self.staff)

        export = self.client.get("/api/v1/store/outbox/export/")

        self.assertEqual(export.status_code, status.HTTP_200_OK)
        self.assertEqual(export["Content-Type"], "application/json")
        self.assertIn("attachment;", export["Content-Disposition"])
        payload = json.loads(export.content.decode())
        self.assertEqual(payload["count"], 2)
        self.assertEqual(len(payload["messages"]), 2)
        self.assertIn("exported_at", payload)
        self.assertEqual(
            {row["kind"] for row in payload["messages"]}, {"student", "staff"}
        )

    def test_the_export_can_be_narrowed_the_same_way(self):
        self.client.force_authenticate(self.staff)

        export = self.client.get("/api/v1/store/outbox/export/?kind=staff")

        payload = json.loads(export.content.decode())
        self.assertEqual(payload["count"], 1)
        self.assertEqual(payload["messages"][0]["event"], "low_stock")


class StoreMailTests(StoreApiTestCase):
    """NT-02 with EM-01 to EM-04: the store's mail is prepared, honest, and skipped
    when there is nowhere to send it."""

    def prepare_with_status(self, status):
        from apps.store.services import change_ticket_status

        ticket = self.make_ticket()
        change_ticket_status(ticket, status, by=self.staff)
        return ticket

    def make_ticket(self):
        from apps.store.models import TicketItem

        ticket = OfficialTicket.objects.create(
            buyer=self.student,
            status=OfficialTicket.Status.REQUEST_RECEIVED,
            pickup_date=None,
            claim_notes="After class, around 4pm.",
        )
        TicketItem.objects.create(
            ticket=ticket,
            listing=self.listing,
            variant=self.variant,
            quantity=1,
            unit_price=Decimal("450.00"),
        )
        return ticket

    def test_every_status_leaves_a_prepared_message(self):
        ticket = self.make_ticket()
        from apps.store.services import change_ticket_status

        change_ticket_status(ticket, OfficialTicket.Status.CONFIRMED, by=self.staff)
        change_ticket_status(ticket, OfficialTicket.Status.READY_FOR_PICKUP, by=self.staff)

        rows = EmailOutbox.objects.filter(ticket=ticket).order_by("created_at")
        self.assertEqual([r.event for r in rows], ["confirmed", "ready_for_pickup"])
        self.assertTrue(all(r.state == EmailOutbox.State.PREPARED for r in rows))
        self.assertEqual(rows[0].recipients, ["2024-123456@rtu.edu.ph"])

    def test_the_message_carries_what_the_srs_lists_and_nothing_it_forbids(self):
        ticket = self.make_ticket()
        from apps.store.mail import ticket_message

        message = ticket_message(ticket)
        body = message["body"]

        self.assertIn(ticket.reference, body)
        self.assertIn("Request Received", body)
        self.assertIn("Official Uniform", body)
        self.assertIn("Medium", body)          # the size, from the variant
        self.assertIn("Pickup date", body)
        self.assertIn("After class", body)     # the claim notes
        self.assertIn("automatic", body)

        # EM-03: never the student number, the name, or a payment link.
        self.assertNotIn("2024-123456", body)
        self.assertNotIn(self.student.display_name, body)
        self.assertNotIn("http", body.lower())
        self.assertNotIn("pay now", body.lower())

    def test_a_non_rtu_address_skips_the_message_with_a_reason(self):
        outsider = make_user("someone@gmail.com")
        ticket = OfficialTicket.objects.create(
            buyer=outsider,
            status=OfficialTicket.Status.REQUEST_RECEIVED,
        )
        from apps.store.mail import prepare_ticket_email

        row = prepare_ticket_email(ticket)

        self.assertEqual(row.state, EmailOutbox.State.SKIPPED)
        self.assertEqual(row.recipients, [])
        self.assertIn("No RTU email address", row.note)

    def test_a_low_stock_crossing_warns_the_office(self):
        """A walk-in sale is the simplest crossing: on hand falls to the line."""
        from apps.store.models import StoreSetting
        from apps.store.services import record_walk_in_sale

        setting = StoreSetting.get_solo()
        setting.low_stock_threshold = 3
        setting.low_stock_emails = ["bao@rtu.edu.ph"]
        setting.save()

        self.variant.on_hand = 4
        self.variant.available = 4  # the schema requires available <= on_hand
        self.variant.save(update_fields=["on_hand", "available"])

        record_walk_in_sale([(self.variant, 1)], by=self.staff)

        low = EmailOutbox.objects.filter(event="low_stock").first()
        self.assertIsNotNone(low)
        self.assertEqual(low.recipients, ["bao@rtu.edu.ph"])
        self.assertEqual(low.state, EmailOutbox.State.PREPARED)
        self.assertIn("Official Uniform", low.body)

        # Selling another unit does not repeat the warning: only the crossing does.
        record_walk_in_sale([(self.variant, 1)], by=self.staff)
        self.assertEqual(EmailOutbox.objects.filter(event="low_stock").count(), 1)

    def test_a_low_stock_message_without_an_address_is_skipped(self):
        from apps.store.models import StoreSetting
        from apps.store.mail import prepare_low_stock_email

        setting = StoreSetting.get_solo()
        setting.low_stock_threshold = 5
        setting.low_stock_emails = []
        setting.save()
        self.variant.on_hand = 2
        self.variant.available = 2  # the schema requires available <= on_hand
        self.variant.save(update_fields=["on_hand", "available"])

        row = prepare_low_stock_email(self.variant)

        self.assertEqual(row.state, EmailOutbox.State.SKIPPED)
        self.assertIn("No staff address", row.note)

    def test_the_outbox_keeps_the_newest_five_hundred(self):
        from apps.store.mail import OUTBOX_LIMIT
        from apps.store.services import prepare_email

        for index in range(OUTBOX_LIMIT + 5):
            prepare_email(
                kind=EmailOutbox.Kind.STAFF,
                event="bulk",
                recipients=["bao@rtu.edu.ph"],
                subject=f"Bulk {index}",
                body="…",
            )
        from apps.store.mail import _prune

        _prune()

        self.assertEqual(EmailOutbox.objects.count(), OUTBOX_LIMIT)
        self.assertFalse(EmailOutbox.objects.filter(subject="Bulk 0").exists())
        self.assertTrue(
            EmailOutbox.objects.filter(subject=f"Bulk {OUTBOX_LIMIT + 4}").exists()
        )
