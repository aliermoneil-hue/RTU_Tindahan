"""Create demo official items with stock for local testing.

Run after `seed_demo_users` and `seed_categories`:

    python manage.py seed_official_store
"""

from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError

from apps.accounts.models import User
from apps.catalog.models import Category, Listing, ListingVariant
from apps.store.services import record_stock_in

DEMO_ITEMS = [
    {
        "title": "Official RTU Uniform",
        "category": "Uniforms",
        "price": Decimal("550.00"),
        "description": "Official RTU uniform sold by the Office of Student Affairs.",
        "variants": {"Small": 10, "Medium": 10, "Large": 10},
    },
    {
        "title": "Official PE Shirt",
        "category": "Merchandise, Clothes, Accessories, and Gadgets",
        "price": Decimal("350.00"),
        "description": "Official RTU physical education shirt.",
        "variants": {"Small": 5, "Medium": 5, "Large": 5},
    },
]


class Command(BaseCommand):
    help = "Create demo official items, variants, and opening stock."

    def handle(self, *args, **options):
        staff = User.objects.filter(email="staff@rtu.edu.ph").first()
        if staff is None:
            raise CommandError("Run `python manage.py seed_demo_users` first.")
        if not staff.is_office_staff:
            raise CommandError("staff@rtu.edu.ph must have the Office Staff role.")

        for item in DEMO_ITEMS:
            category, _ = Category.objects.get_or_create(
                name=item["category"],
                defaults={"parent": None, "sort_order": 40, "is_active": True},
            )
            listing, created = Listing.objects.update_or_create(
                title=item["title"],
                defaults={
                    "seller": staff,
                    "category": category,
                    "description": item["description"],
                    "listing_type": Listing.Type.PRODUCT,
                    "condition": Listing.Condition.NEW,
                    "price": item["price"],
                    "quantity": 1,
                    "meetup_place": "OSA Office",
                    "is_official": True,
                    "status": Listing.Status.APPROVED,
                },
            )
            if listing.published_at is None:
                from django.utils import timezone

                listing.published_at = timezone.now()
                listing.save(update_fields=["published_at"])

            self.stdout.write(
                f"{'Created' if created else 'Updated'} listing: "
                f"{listing.title} (id {listing.pk})"
            )

            for order, (name, opening) in enumerate(item["variants"].items(), start=1):
                variant, variant_created = ListingVariant.objects.get_or_create(
                    listing=listing,
                    name=name,
                    defaults={"sort_order": order, "is_active": True},
                )
                if not variant.stock_movements.exists():
                    record_stock_in(
                        variant,
                        opening,
                        by=staff,
                        reason="Opening stock for demo",
                    )
                    self.stdout.write(
                        f"  {name}: opened with {opening} units (variant id {variant.pk})"
                    )
                else:
                    self.stdout.write(
                        f"  {name}: already has stock (variant id {variant.pk})"
                    )

        self.stdout.write(
            self.style.SUCCESS(
                "\nDemo official items ready. Sign in as admin@rtu.edu.ph to inspect, "
                "or place a test order with the shell snippet in docs/TESTING-STORE.md."
            )
        )
