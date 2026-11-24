"""AI-14: the Filipino and Taglish phrases reach an existing table.

The code lists carry them now; this copies them in so a database that was seeded
before this change screens the way a fresh one does. `get_or_create` keeps it
safe to run twice, and an administrator who has already added the same phrase
keeps their own note.
"""

from django.db import migrations


def seed_taglish(apps, schema_editor):
    ScreeningRule = apps.get_model("screening", "ScreeningRule")
    from apps.screening.providers import PROHIBITED_TERMS, SCAM_PATTERNS

    for phrase in PROHIBITED_TERMS:
        ScreeningRule.objects.get_or_create(
            phrase=phrase,
            defaults={
                "kind": "prohibited",
                "note": "Seeded from the posting guideline (English, Filipino or Taglish).",
            },
        )
    for phrase in SCAM_PATTERNS:
        ScreeningRule.objects.get_or_create(
            phrase=phrase,
            defaults={
                "kind": "scam",
                "note": "Seeded from the posting guideline (English, Filipino or Taglish).",
            },
        )


def remove_taglish(apps, schema_editor):
    """Leave the English seed alone; drop only the Taglish additions."""
    ScreeningRule = apps.get_model("screening", "ScreeningRule")
    taglish = [
        "may answer key ako",
        "may sagot ako sa exam",
        "sagot ko exam mo",
        "sasagutan ko exam mo",
        "gagawa ako ng assignment mo",
        "gagawa ako ng thesis mo",
        "ako na gagawa ng project mo",
        "peke na id",
        "peke na school id",
        "bayad muna",
        "bayad bago meetup",
        "bayad bago mag meetup",
        "gcash muna",
        "send gcash muna",
        "mag send ka ng gcash",
        "downpayment muna",
    ]
    ScreeningRule.objects.filter(phrase__in=taglish).delete()


class Migration(migrations.Migration):
    dependencies = [("screening", "0005_seed_screening_rules")]
    operations = [migrations.RunPython(seed_taglish, remove_taglish)]
