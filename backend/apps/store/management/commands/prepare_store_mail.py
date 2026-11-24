"""Prepare the store's message for tickets that already exist (EM-01, NT-02).

Sending was switched off when these tickets were made, so no message was ever
prepared for them. This command walks the tickets that have no message for their
current status and writes one, which is what the outbox screen would have shown
had the switch been on all along.

It writes to the outbox and nothing else. Nothing is sent.
"""

from django.core.management.base import BaseCommand

from apps.store.mail import prepare_ticket_email, ticket_event_label
from apps.store.models import EmailOutbox, OfficialTicket


class Command(BaseCommand):
    help = "Prepare the outbox message for every ticket that does not have one yet."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Say what would be written, write nothing.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        written = 0

        for ticket in OfficialTicket.objects.select_related("buyer").order_by("created_at"):
            event = ticket_event_label(ticket, ticket.status)
            exists = EmailOutbox.objects.filter(ticket=ticket, event=event).exists()
            if exists:
                continue
            self.stdout.write(f"  {ticket.reference} · {event}")
            if not dry_run:
                prepare_ticket_email(ticket, event=event)
            written += 1

        if dry_run:
            self.stdout.write(self.style.WARNING(f"Dry run: {written} message(s) would be prepared."))
        else:
            self.stdout.write(self.style.SUCCESS(f"Prepared {written} message(s). Nothing was sent."))
