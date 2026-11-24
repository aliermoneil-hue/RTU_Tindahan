"""Delete finished records past the retention period (PR-05).

The SRS asks for a defined and documented retention period, and leaves the
number itself to the University (Appendix B.2, item 2). So the number is a
setting — `DATA_RETENTION_DAYS`, default 730 (two years) — and this command is
the thing that honours it:

- an order that reached a terminal state (`declined`, `completed`, `cancelled`)
  and has not moved since before the cutoff is deleted, taking its reviews with
  it (the FK cascades, which is the point: PR-06 keeps a review for the same
  period as the order it judges);
- an order still `requested` or `accepted` is never touched, however old — it is
  a live obligation, not a record;
- read notifications older than `NOTIFICATION_RETENTION_DAYS` (90) go too; they
  are housekeeping, not history;
- accounts, listings, posts and comments are left alone. Nothing here is about
  the living.

Run it nightly from cron, before the backup, so the backup holds the trimmed
set:

    30 3 * * *  cd /home/kallisto/RTU_Tindahan/backend && \\
        .venv/bin/python manage.py purge_expired_data >> /home/kallisto/backups/tindahan/retention.log 2>&1

`--dry-run` reports what would go and deletes nothing. With
`DATA_RETENTION_DAYS=0` (or `NOTIFICATION_RETENTION_DAYS=0`) that family is
left alone and the command says so.
"""

from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.notifications.models import Notification
from apps.orders.models import Order


TERMINAL = (
    Order.Status.DECLINED,
    Order.Status.COMPLETED,
    Order.Status.CANCELLED,
)


class Command(BaseCommand):
    help = "Delete terminal orders and read notifications past the retention period (PR-05)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would be deleted and change nothing.",
        )
        parser.add_argument(
            "--days",
            type=int,
            default=None,
            help="Override DATA_RETENTION_DAYS for this run.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        now = timezone.now()

        order_days = options["days"]
        if order_days is None:
            order_days = settings.DATA_RETENTION_DAYS

        if order_days:
            cutoff = now - timedelta(days=order_days)
            old_orders = Order.objects.filter(status__in=TERMINAL, updated_at__lt=cutoff)
            count = old_orders.count()
            if dry_run:
                self.stdout.write(
                    f"would delete {count} terminal order(s) untouched since "
                    f"{cutoff.date()} (retention {order_days} days)"
                )
            else:
                deleted, _ = old_orders.delete()
                self.stdout.write(
                    f"deleted {count} terminal order(s) untouched since {cutoff.date()} "
                    f"({deleted} rows in all, reviews included)"
                )
        else:
            self.stdout.write("DATA_RETENTION_DAYS=0: orders are kept indefinitely")

        note_days = settings.NOTIFICATION_RETENTION_DAYS
        if note_days:
            cutoff = now - timedelta(days=note_days)
            old_notes = Notification.objects.filter(read_at__isnull=False, read_at__lt=cutoff)
            count = old_notes.count()
            if dry_run:
                self.stdout.write(
                    f"would delete {count} read notification(s) older than {cutoff.date()}"
                )
            else:
                old_notes.delete()
                self.stdout.write(
                    f"deleted {count} read notification(s) older than {cutoff.date()}"
                )
        else:
            self.stdout.write(
                "NOTIFICATION_RETENTION_DAYS=0: notifications are kept indefinitely"
            )
