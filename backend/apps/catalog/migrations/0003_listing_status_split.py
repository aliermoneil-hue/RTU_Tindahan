"""Split Listing.status into a moderation state and an availability state.

One column carried two independent facts, so "approved but out of stock" could
not be expressed: the states were mutually exclusive by construction. This adds
moderation_status and availability_status, maps every existing value onto the
pair it really meant, and only then drops the old column.
"""

from django.conf import settings
from django.db import migrations, models


# old combined value -> (moderation_status, availability_status)
MAPPING = {
    "draft": ("draft", "available"),
    "pending_screening": ("pending_screening", "available"),
    "approved": ("approved", "available"),
    "needs_review": ("needs_review", "available"),
    "rejected": ("rejected", "unavailable"),
    "sold": ("approved", "sold"),
    "unavailable": ("approved", "unavailable"),
    "removed": ("approved", "removed"),
}


def forwards(apps, schema_editor):
    Listing = apps.get_model("catalog", "Listing")
    for old, (moderation, availability) in MAPPING.items():
        Listing.objects.filter(status=old).update(
            moderation_status=moderation, availability_status=availability
        )
    # Anything unrecognised (or blank) keeps the field defaults, which read as
    # "waiting for screening and available" — the safe reading of an unknown row.


def backwards(apps, schema_editor):
    Listing = apps.get_model("catalog", "Listing")
    reverse = {pair: old for old, pair in MAPPING.items()}
    for (moderation, availability), old in reverse.items():
        Listing.objects.filter(
            moderation_status=moderation, availability_status=availability
        ).update(status=old)
    # Combinations that could not exist before (approved+removed, rejected+sold
    # is blocked by the constraint, anything an administrator invented) collapse
    # back to the closest single value.
    for listing in Listing.objects.all().iterator():
        listing.status = (
            "sold" if listing.availability_status == "sold" else listing.moderation_status
        )
        listing.save(update_fields=["status"])


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0002_listingvariant"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="listing",
            name="availability_status",
            field=models.CharField(
                choices=[
                    ("available", "Available"),
                    ("sold", "Sold"),
                    ("unavailable", "Unavailable"),
                    ("removed", "Removed"),
                ],
                db_index=True,
                default="available",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="listing",
            name="moderation_status",
            field=models.CharField(
                choices=[
                    ("draft", "Draft"),
                    ("pending_screening", "Pending screening"),
                    ("approved", "Approved"),
                    ("needs_review", "Needs review"),
                    ("rejected", "Rejected"),
                ],
                db_index=True,
                default="pending_screening",
                max_length=30,
            ),
        ),
        migrations.RunPython(forwards, backwards),
        migrations.RemoveIndex(
            model_name="listing",
            name="catalog_lis_status_7f6b2e_idx",
        ),
        migrations.RemoveIndex(
            model_name="listing",
            name="catalog_lis_categor_08ce89_idx",
        ),
        migrations.RemoveIndex(
            model_name="listing",
            name="catalog_lis_seller__b4d1ae_idx",
        ),
        migrations.RemoveField(
            model_name="listing",
            name="status",
        ),
        migrations.AddIndex(
            model_name="listing",
            index=models.Index(
                fields=["moderation_status", "published_at"],
                name="catalog_lis_moderat_275d42_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="listing",
            index=models.Index(
                fields=["category", "moderation_status"],
                name="catalog_lis_categor_7a3e4f_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="listing",
            index=models.Index(
                fields=["seller", "moderation_status"],
                name="catalog_lis_seller__d6163f_idx",
            ),
        ),
        migrations.AddConstraint(
            model_name="listing",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    ("moderation_status", "rejected"),
                    ("availability_status", "sold"),
                    _negated=True,
                ),
                name="catalog_rejected_listing_not_sold",
            ),
        ),
    ]
