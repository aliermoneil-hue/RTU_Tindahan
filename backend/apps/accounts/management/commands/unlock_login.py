"""Clear a login lock so a person can sign in again (SE-05).

Five failures in a row lock an address for fifteen minutes, which is what the
SRS asks for and also exactly long enough to ruin a demonstration. This is the
honest way out: it deletes the failed-attempt record, it does not weaken the
rule, and the audit log still holds whatever the failed attempts produced.

    manage.py unlock_login 2024-200374@rtu.edu.ph
    manage.py unlock_login --all
"""

from django.core.management.base import BaseCommand

from apps.accounts.lockout import reset
from apps.accounts.models import LoginAttempt


class Command(BaseCommand):
    help = "Clear the failed-login lock on an email address (or every address)."

    def add_arguments(self, parser):
        parser.add_argument(
            "email",
            nargs="?",
            help="The address to unlock. Omit it with --all.",
        )
        parser.add_argument(
            "--all",
            action="store_true",
            help="Clear every lock. Intended for a demo laptop, not a server.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Say what would be cleared, and change nothing.",
        )

    def handle(self, *args, **options):
        if not options["email"] and not options["all"]:
            self.stderr.write("Name an email address, or pass --all.")
            return

        targets = (
            list(LoginAttempt.objects.values_list("email", flat=True))
            if options["all"]
            else [(options["email"] or "").strip().lower()]
        )

        if not targets:
            self.stdout.write("No failed-login records exist. Nothing to unlock.")
            return

        for email in targets:
            locked = LoginAttempt.objects.filter(
                email=email, locked_until__isnull=False
            ).exists()
            if options["dry_run"]:
                state = "locked" if locked else "no lock"
                self.stdout.write(f"{email}: {state} (would clear)")
                continue
            reset(email)
            self.stdout.write(f"{email}: cleared")

        if not options["dry_run"]:
            self.stdout.write(
                self.style.SUCCESS(f"Unlocked {len(targets)} address(es).")
            )
