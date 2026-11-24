"""PR-05: the retention period is a setting, and something has to honour it.

These tests are about the boundary, not the arithmetic: a finished order dies on
schedule, a live one never does, a dry run changes nothing, and an override lets
an administrator ask "what would 30 days remove?" without waiting for the clock.
"""

from datetime import timedelta
from io import StringIO

from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone

from apps.accounts.models import User
from apps.notifications.models import Notification
from apps.orders.models import Order
from apps.reviews.models import Review


def run(*args):
    out = StringIO()
    call_command("purge_expired_data", *args, stdout=out)
    return out.getvalue()


class PurgeExpiredDataTests(TestCase):
    def setUp(self):
        self.seller = User.objects.create_user(
            email="2024-777001@rtu.edu.ph", password="Ib@ughtAcalc1", display_name="Seller"
        )
        self.buyer = User.objects.create_user(
            email="2024-777002@rtu.edu.ph", password="Ib@ughtAcalc1", display_name="Buyer"
        )

    def make_order(self, status, age_days):
        # An explicit reference: two orders created in the same second would
        # otherwise be handed the same generated sequence number.
        reference = f"ORD-T{Order.objects.count() + 1:03d}"
        order = Order.objects.create(
            reference=reference,
            buyer=self.buyer,
            seller=self.seller,
            status=status,
            meetup_place="Main lobby",
        )
        stamp = timezone.now() - timedelta(days=age_days)
        Order.objects.filter(pk=order.pk).update(created_at=stamp, updated_at=stamp)
        return order

    def test_a_finished_order_past_the_period_is_deleted_with_its_review(self):
        order = self.make_order(Order.Status.COMPLETED, age_days=800)
        Review.objects.create(order=order, buyer=self.buyer, seller=self.seller, stars=5)

        output = run()

        self.assertFalse(Order.objects.filter(pk=order.pk).exists())
        self.assertEqual(Review.objects.count(), 0)
        self.assertIn("deleted 1 terminal order", output)

    def test_a_finished_order_inside_the_period_survives(self):
        order = self.make_order(Order.Status.COMPLETED, age_days=100)

        run()

        self.assertTrue(Order.objects.filter(pk=order.pk).exists())

    def test_an_open_order_is_never_purged_however_old(self):
        requested = self.make_order(Order.Status.REQUESTED, age_days=900)
        accepted = self.make_order(Order.Status.ACCEPTED, age_days=900)

        run()

        self.assertTrue(Order.objects.filter(pk=requested.pk).exists())
        self.assertTrue(Order.objects.filter(pk=accepted.pk).exists())

    def test_a_dry_run_changes_nothing(self):
        order = self.make_order(Order.Status.COMPLETED, age_days=900)

        output = run("--dry-run")

        self.assertTrue(Order.objects.filter(pk=order.pk).exists())
        self.assertIn("would delete 1 terminal order", output)

    def test_the_period_can_be_asked_about_without_waiting(self):
        order = self.make_order(Order.Status.COMPLETED, age_days=40)

        output = run("--dry-run", "--days", "30")

        self.assertIn("would delete 1 terminal order", output)
        self.assertTrue(Order.objects.filter(pk=order.pk).exists())

    def test_read_notifications_expire_and_unread_ones_do_not(self):
        old = timezone.now() - timedelta(days=200)
        read = Notification.objects.create(user=self.buyer, kind="system", text="Read me")
        Notification.objects.filter(pk=read.pk).update(read_at=old)
        unread = Notification.objects.create(user=self.buyer, kind="system", text="Keep me")

        output = run()

        self.assertFalse(Notification.objects.filter(pk=read.pk).exists())
        self.assertTrue(Notification.objects.filter(pk=unread.pk).exists())
        self.assertIn("deleted 1 read notification", output)

    @override_settings(DATA_RETENTION_DAYS=0)
    def test_a_zero_period_disables_the_purge_and_says_so(self):
        order = self.make_order(Order.Status.COMPLETED, age_days=900)

        output = run()

        self.assertTrue(Order.objects.filter(pk=order.pk).exists())
        self.assertIn("kept indefinitely", output)
