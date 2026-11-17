from django.core.management.base import BaseCommand

from apps.catalog.models import Category

# name, children, sort_order
CATEGORIES = [
    ("Food and Snacks", [], 10),
    ("Uniforms", ["Uniform"], 20),
    (
        "Books, Modules, and School Supplies",
        ["Textbook", "Manual", "Reviewer or Notes"],
        30,
    ),
    (
        "Merchandise, Clothes, Accessories, and Gadgets",
        ["Clothing", "Accessories", "Gadgets"],
        40,
    ),
    ("Services", ["Printing", "Tutoring", "Repairs"], 50),
    ("Other", [], 60),
]


class Command(BaseCommand):
    help = "Create the SRS categories and their sub-types (LS-02)."

    def handle(self, *args, **options):
        for name, children, base_order in CATEGORIES:
            parent, created = Category.objects.update_or_create(
                name=name,
                defaults={
                    "parent": None,
                    "sort_order": base_order,
                    "is_active": True,
                },
            )
            self.stdout.write(
                f"{'Created' if created else 'Updated'} parent: {parent.name}"
            )

            for index, child_name in enumerate(children, start=1):
                child, child_created = Category.objects.update_or_create(
                    name=child_name,
                    defaults={
                        "parent": parent,
                        "sort_order": base_order + index,
                        "is_active": True,
                    },
                )
                self.stdout.write(
                    f"  {'Created' if child_created else 'Updated'} child: {child.name}"
                )