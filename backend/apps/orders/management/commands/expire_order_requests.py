"""Cancel every request the seller never answered (OT-12).

The clock is `ORDER_REQUEST_TTL_HOURS` (default 48), stamped on an order as
`expires_at` when the buyer sends it. The API also sweeps on every read, so a
lapsed request disappears from the screen even if cron has not run — this
command exists so the database settles on its own, nightly and after any gap,
and so both parties are told without waiting for someone to open the page.

    0 4 * * *  cd /home/kallisto/RTU_Tindahan/backend && \\
        .venv/bin/python manage.py expire_order_requests >> /home/kallisto/backups/tindahan/orders.log 2>&1

`--dry-run` lists what would be cancelled. With `ORDER_REQUEST_TTL_HOURS=0` the
clock is switched off and the command says so.
"""

from django.conf import settings

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.orders.models import Order
from apps.orders.services import expire_overdue_requests


class Command(BaseCommand):
    help = "Cancel unanswered requests past ORDER_REQUEST_TTL_HOURS and notify both parties."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="List what would be cancelled and change nothing.",
        )

    def handle(self, *args, **options):
        hours = getattr(settings, "ORDER_REQUEST_TTL_HOURS", 0) or 0
        if hours <= 0:
            self.stdout.write(
                "ORDER_REQUEST_TTL_HOURS=0: requests never expire on their own."
            )
            return

        now = timezone.now()
        if options["dry_run"]:
            lapsed = Order.objects.filter(
                status=Order.Status.REQUESTED, expires_at__isnull=False, expires_at__lte=now
            )
            count = lapsed.count()
            for order in lapsed[:50]:
                self.stdout.write(
                    f"would cancel {order.reference} (waited until {order.expires_at:%Y-%m-%d %H:%M})"
                )
            self.stdout.write(f"would cancel {count} request(s) older than {hours} hours")
            return

        expired = expire_overdue_requests(now=now)
        if expired:
            self.stdout.write(
                f"cancelled {len(expired)} unanswered request(s) after {hours} hours: "
                + ", ".join(expired[:20])
            )
        else:
            self.stdout.write(f"nothing to cancel; no request older than {hours} hours")
