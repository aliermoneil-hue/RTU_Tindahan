"""Create one demo account per role for local testing.

Run only in development:

    python manage.py seed_demo_users

The password is printed at the end. Do not run this against a deployed
database.
"""

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.accounts.models import User

DEMO_ACCOUNTS = [
    {
        "email": "admin@rtu.edu.ph",
        "display_name": "System Administrator",
        "role": User.Role.ADMINISTRATOR,
        "member_type": User.MemberType.PERSONNEL,
        "college": "Administration",
        "year_level": None,
        "is_staff": True,
        "is_superuser": True,
    },
    {
        "email": "staff@rtu.edu.ph",
        "display_name": "Office Staff",
        "role": User.Role.OFFICE_STAFF,
        "member_type": User.MemberType.PERSONNEL,
        "college": "Office of Student Affairs",
        "year_level": None,
        "is_staff": False,
        "is_superuser": False,
    },
    {
        "email": "moderator@rtu.edu.ph",
        "display_name": "Content Moderator",
        "role": User.Role.MODERATOR,
        "member_type": User.MemberType.PERSONNEL,
        "college": "Office of Student Affairs",
        "year_level": None,
        "is_staff": False,
        "is_superuser": False,
    },
    {
        "email": "2024-000001@rtu.edu.ph",
        "display_name": "Demo Student",
        "role": User.Role.USER,
        "member_type": User.MemberType.STUDENT,
        "college": "College of Information and Communications Technology",
        "year_level": 2,
        "is_staff": False,
        "is_superuser": False,
    },
]


class Command(BaseCommand):
    help = "Create one verified demo account per role (development only)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--password",
            default="Tindahan2026!",
            help="Password for every demo account (default: Tindahan2026!).",
        )

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("seed_demo_users only runs when DJANGO_DEBUG=True.")

        password = options["password"]
        now = timezone.now()

        for spec in DEMO_ACCOUNTS:
            user, created = User.objects.update_or_create(
                email=spec["email"],
                defaults={
                    "display_name": spec["display_name"],
                    "role": spec["role"],
                    "member_type": spec["member_type"],
                    "college": spec["college"],
                    "year_level": spec["year_level"],
                    "status": User.Status.ACTIVE,
                    "is_active": True,
                    "is_staff": spec["is_staff"],
                    "is_superuser": spec["is_superuser"],
                    "verified_at": now,
                },
            )
            user.set_password(password)
            user.save(update_fields=["password"])

            action = "Created" if created else "Updated"
            self.stdout.write(f"{action}: {user.email} ({user.get_role_display()})")

        self.stdout.write(
            self.style.WARNING(
                f"\nAll demo accounts use the password: {password}\n"
                "Change or delete them before any real deployment."
            )
        )
