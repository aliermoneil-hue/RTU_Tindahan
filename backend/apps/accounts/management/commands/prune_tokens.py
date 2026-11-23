"""Delete sign-in tokens that are past `AUTH_TOKEN_TTL_DAYS`.

The authentication class already refuses an aged token, so this command changes
no behaviour: it only removes rows that can never authenticate again. That keeps
the table from growing one dead row per account per rotation.

Run it from cron. A daily 03:10 run is enough:

    10 3 * * *  cd /home/kallisto/RTU_Tindahan/backend && \
        .venv/bin/python manage.py prune_tokens >/dev/null 2>&1

`--dry-run` reports what would go. With `AUTH_TOKEN_TTL_DAYS=0` tokens never
expire, so the command says so and deletes nothing.
"""

from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone
from rest_framework.authtoken.models import Token


class Command(BaseCommand):
    help = "Delete authentication tokens older than AUTH_TOKEN_TTL_DAYS."

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=None,
            help="Age in days; defaults to AUTH_TOKEN_TTL_DAYS.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report how many tokens would be deleted, without deleting.",
        )

    def handle(self, *args, **options):
        days = options["days"]
        if days is None:
            days = int(getattr(settings, "AUTH_TOKEN_TTL_DAYS", 0) or 0)

        if days <= 0:
            self.stdout.write(
                "AUTH_TOKEN_TTL_DAYS is 0, so sign-in tokens never expire; "
                "nothing to prune."
            )
            return

        cutoff = timezone.now() - timedelta(days=days)
        stale = Token.objects.filter(created__lt=cutoff)
        count = stale.count()

        if options["dry_run"]:
            self.stdout.write(
                f"{count} token(s) older than {days} day(s) would be deleted "
                "(--dry-run, nothing removed)."
            )
            return

        deleted, _ = stale.delete()
        self.stdout.write(
            self.style.SUCCESS(
                f"Deleted {deleted} token(s) older than {days} day(s)."
            )
        )
