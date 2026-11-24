"""Two orders created in the same instant must not take the same number.

The stress run found this the hard way: 24 simultaneous order requests produced 13
server errors, because `_next_reference` counted the day's rows and added one, so
every writer in the same second computed the same reference and one of each pair
died on the unique constraint. These tests pin the two halves of the fix — the
number no longer reuses a deleted order's slot, and a collision is retried rather
than raised.
"""

from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase

from apps.accounts.models import User
from apps.catalog.models import Category, Listing
from apps.orders.models import Order
from apps.orders.services import _next_reference, place_order


def make_user(email):
    user = User.objects.create_user(
        email=email,
        display_name=email.split("@")[0],
        password="SecurePass123!",
        member_type=User.MemberType.STUDENT,
        college="College of ICT",
        year_level=2,
    )
    user.verify()
    return user


class ReferenceNumberTests(TestCase):
    def setUp(self):
        self.seller = make_user("2024-555001@rtu.edu.ph")
        self.buyer = make_user("2024-555002@rtu.edu.ph")
        self.category = Category.objects.create(name="Gadgets")
        self.listing = Listing.objects.create(
            seller=self.seller,
            category=self.category,
            title="Secondhand Calculator",
            description="All keys working.",
            price=Decimal("350.00"),
            quantity=5,
            moderation_status=Listing.ModerationStatus.APPROVED,
            availability_status=Listing.AvailabilityStatus.AVAILABLE,
        )

    def order_with(self, reference):
        return Order.objects.create(
            reference=reference,
            buyer=self.buyer,
            seller=self.seller,
            fulfillment=Listing.Fulfillment.PICKUP,
            meetup_place="Main lobby",
        )

    def test_a_deleted_order_does_not_hand_its_number_on(self):
        from django.utils import timezone

        day = timezone.localdate()
        first = self.order_with(_next_reference(day))       # ...-001
        second = self.order_with(_next_reference(day))      # ...-002
        self.assertNotEqual(first.reference, second.reference)

        first.delete()  # stretch: counting rows would now hand out 002 again

        self.assertEqual(_next_reference(day), "ORD-" + f"{day:%y%m%d}" + "-003")

    def test_a_colliding_reference_is_retried_rather_than_raised(self):
        from django.utils import timezone

        day = timezone.localdate()
        taken = self.order_with("ORD-990101-001")
        calls = {"n": 0}

        def racing_reference(_day):
            calls["n"] += 1
            # The first attempt returns the number another writer just took.
            return taken.reference if calls["n"] == 1 else f"ORD-990101-{calls['n']:03d}"

        with patch("apps.orders.services._next_reference", side_effect=racing_reference):
            order = place_order(
                buyer=self.buyer,
                lines=[{"listing": self.listing, "quantity": 1}],
                meetup_place="Main lobby",
            )

        self.assertEqual(calls["n"], 2, "the collision must be retried once, not raised")
        self.assertEqual(order.reference, "ORD-990101-002")
        self.assertEqual(Order.objects.filter(reference=order.reference).count(), 1)

    def test_the_number_keeps_widening_past_nine_hundred_and_ninety_nine(self):
        from django.utils import timezone

        day = timezone.localdate()
        prefix = f"ORD-{day:%y%m%d}-"
        self.order_with(f"{prefix}999")

        self.assertEqual(_next_reference(day), f"{prefix}1000")
