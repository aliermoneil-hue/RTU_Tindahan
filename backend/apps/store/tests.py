from decimal import Decimal

from django.core.exceptions import ValidationError
from django.test import TestCase

from apps.accounts.models import User
from apps.catalog.models import Category, Listing, ListingVariant
from apps.store.models import EmailOutbox, OfficialTicket, StockMovement
from apps.store.services import (
    change_ticket_status,
    place_official_order,
    record_daily_count,
    record_stock_in,
)


def make_user(email, role=User.Role.USER):
    user = User.objects.create_user(
        email=email,
        display_name=email.split("@")[0],
        password="SecurePass123!",
        member_type=User.MemberType.STUDENT,
        college="College of ICT",
        year_level=2,
    )
    user.role = role
    user.verify()
    return user


class OfficialStoreTestCase(TestCase):
    def setUp(self):
        self.staff = make_user("staff@rtu.edu.ph", role=User.Role.OFFICE_STAFF)
        self.student = make_user("2024-123456@rtu.edu.ph")
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
        return place_official_order(
            buyer=self.student,
            items=[
                {
                    "listing": self.listing,
                    "variant": self.variant,
                    "quantity": quantity,
                }
            ],
            created_by=self.student,
        )

    def test_reference_format(self):
        ticket = self.order()
        self.assertRegex(ticket.reference, r"^TXN-\d{6}-\d{3}$")

    def test_order_reserves_stock(self):
        ticket = self.order(3)

        self.variant.refresh_from_db()
        self.assertEqual(self.variant.on_hand, 10)
        self.assertEqual(self.variant.available, 7)
        self.assertEqual(self.variant.reserved, 3)
        self.assertEqual(ticket.status, OfficialTicket.Status.REQUEST_RECEIVED)
        self.assertEqual(
            StockMovement.objects.filter(
                ticket=ticket, kind=StockMovement.Kind.RESERVED
            ).count(),
            1,
        )

    def test_cancel_releases_stock(self):
        ticket = self.order(3)
        change_ticket_status(
            ticket,
            OfficialTicket.Status.CANCELLED,
            by=self.staff,
            note="Student changed their mind",
        )

        self.variant.refresh_from_db()
        self.assertEqual(self.variant.available, 10)
        self.assertEqual(self.variant.reserved, 0)

    def test_claim_issues_stock(self):
        ticket = self.order(3)
        change_ticket_status(ticket, OfficialTicket.Status.CONFIRMED, by=self.staff)
        change_ticket_status(
            ticket, OfficialTicket.Status.READY_FOR_PICKUP, by=self.staff
        )
        change_ticket_status(ticket, OfficialTicket.Status.CLAIMED, by=self.staff)

        self.variant.refresh_from_db()
        self.assertEqual(self.variant.on_hand, 7)
        self.assertEqual(self.variant.available, 7)
        self.assertEqual(self.variant.reserved, 0)

    def test_cannot_reserve_more_than_available(self):
        with self.assertRaises(ValidationError):
            self.order(11)

    def test_cannot_ticket_a_student_listing(self):
        student_listing = Listing.objects.create(
            seller=self.student,
            category=self.listing.category,
            title="Not Official",
            description="Student item.",
            listing_type=Listing.Type.PRODUCT,
            condition=Listing.Condition.NEW,
            price=Decimal("50.00"),
            quantity=1,
            meetup_place="Main gate",
        )
        with self.assertRaises(ValidationError):
            place_official_order(
                buyer=self.student,
                items=[
                    {
                        "listing": student_listing,
                        "variant": self.variant,
                        "quantity": 1,
                    }
                ],
            )

    def test_invalid_status_transition_is_refused(self):
        ticket = self.order(1)
        with self.assertRaises(ValidationError):
            change_ticket_status(ticket, OfficialTicket.Status.CLAIMED, by=self.staff)

    def test_daily_count_creates_adjustment(self):
        count = record_daily_count(
            self.variant, 8, by=self.staff, reason="Two units missing"
        )

        self.variant.refresh_from_db()
        self.assertEqual(count.difference, -2)
        self.assertEqual(self.variant.on_hand, 8)
        self.assertEqual(self.variant.available, 8)
        self.assertEqual(
            StockMovement.objects.filter(
                daily_count=count, kind=StockMovement.Kind.ADJUSTMENT
            ).count(),
            1,
        )

    def test_daily_count_requires_reason_when_different(self):
        with self.assertRaises(ValidationError):
            record_daily_count(self.variant, 8, by=self.staff)

    def test_email_outbox_is_prepared_not_sent(self):
        ticket = self.order(1)
        message = EmailOutbox.objects.create(
            ticket=ticket,
            kind=EmailOutbox.Kind.STUDENT,
            event="Request Received",
            recipients=[self.student.email],
            subject="Ticket received",
            body="Prepared only.",
        )
        self.assertIsNone(message.sent_at)
        self.assertEqual(message.state, EmailOutbox.State.PREPARED)
