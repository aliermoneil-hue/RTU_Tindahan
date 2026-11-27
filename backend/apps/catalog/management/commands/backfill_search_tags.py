"""Read search keywords off the photos of listings that were published before them.

`Listing.search_tags` is filled in when a listing is posted. Every listing that
existed before the column was added has an empty phrase, and those are exactly
the rows a demo searches first, so the column is no use until they are backfilled
— once, from the photos already on disk. No picture leaves the server and
nothing is re-uploaded: this re-reads stored files.

    manage.py backfill_search_tags --dry-run   # how many rows, touching nothing
    manage.py backfill_search_tags             # fill them in
    manage.py backfill_search_tags --limit 20  # a first look, then the rest

Rows without photos, and rows whose picture the model cannot read, are counted
separately and left alone: their search remains the title, the description and
the category, which is what it was before. `--refresh` also re-reads rows that
already have keywords, for when the model or the instruction changes.

Run it from the shell, not from cron: it makes one model call per listing, so it
is a one-off job with a visible progress line, not a nightly sweep.
"""

from django.core.management.base import BaseCommand

from apps.catalog.indexing import stamp_search_tags
from apps.catalog.models import Listing


class Command(BaseCommand):
    help = "Read search keywords from listing photos and store them on each listing."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would be read, and change nothing.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Stop after this many listings (0 means all of them).",
        )
        parser.add_argument(
            "--refresh",
            action="store_true",
            help="Also re-read listings that already carry keywords.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        limit = options["limit"] or 0

        rows = Listing.objects.filter(photos__isnull=False).distinct()
        if not options["refresh"]:
            rows = rows.filter(search_tags="")
        rows = rows.order_by("id")
        if limit:
            rows = rows[:limit]

        total = rows.count() if hasattr(rows, "count") else len(rows)
        self.stdout.write(f"{total} listing(s) to read.")

        filled, unreadable, failed = 0, 0, 0
        for listing in rows:
            if dry_run:
                self.stdout.write(f"  would read #{listing.pk} {listing.title}")
                continue
            try:
                phrase = stamp_search_tags(listing)
            except Exception as exc:  # noqa: BLE001 - one bad row, not the job
                failed += 1
                self.stderr.write(f"  #{listing.pk} failed: {type(exc).__name__}")
                continue
            if phrase:
                filled += 1
                self.stdout.write(f"  #{listing.pk} {listing.title} -> {phrase}")
            else:
                unreadable += 1
                self.stdout.write(f"  #{listing.pk} {listing.title} -> (no words)")

        if dry_run:
            self.stdout.write("Dry run: nothing written.")
            return
        self.stdout.write(
            self.style.SUCCESS(
                f"Filled {filled}, unreadable {unreadable}, failed {failed}."
            )
        )
