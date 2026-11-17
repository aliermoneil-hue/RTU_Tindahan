from django.core.management.base import BaseCommand, CommandError

from apps.accounts.models import User
from apps.catalog.models import ListingVariant
from apps.store.services import record_stock_in


class Command(BaseCommand):
    help = "Add stock to a listing variant and write a ledger entry."

    def add_arguments(self, parser):
        parser.add_argument("variant_id", type=int)
        parser.add_argument("quantity", type=int)
        parser.add_argument(
            "--email",
            help="Email of the Office Staff member recording the stock.",
        )
        parser.add_argument("--reason", default="New stock received")

    def handle(self, *args, **options):
        try:
            variant = ListingVariant.objects.select_related("listing").get(
                pk=options["variant_id"]
            )
        except ListingVariant.DoesNotExist as exc:
            raise CommandError("No listing variant with that id.") from exc

        if options["quantity"] < 1:
            raise CommandError("Quantity must be at least 1.")

        by = None
        if options["email"]:
            by = User.objects.filter(email=options["email"].lower()).first()
            if by is None:
                raise CommandError("No user with that email.")
            if not by.is_office_staff:
                raise CommandError("That user is not Office Staff.")

        movement = record_stock_in(
            variant,
            options["quantity"],
            by=by,
            reason=options["reason"],
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"{variant}: +{movement.quantity} -> "
                f"on hand {movement.on_hand_after}, "
                f"available {movement.available_after}"
            )
        )
