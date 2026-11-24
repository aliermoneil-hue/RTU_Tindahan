"""Seed the rules table with the list the code shipped (AI-10).

The code keeps its terms as the floor; this copies them into the table so an
administrator starts from exactly the screening the platform already had, and
any later edit is a row change rather than a release.
"""

from django.db import migrations


def seed(apps, schema_editor):
    ScreeningRule = apps.get_model("screening", "ScreeningRule")
    from apps.screening.providers import PROHIBITED_TERMS, SCAM_PATTERNS

    for phrase in PROHIBITED_TERMS:
        ScreeningRule.objects.get_or_create(
            phrase=phrase,
            defaults={"kind": "prohibited", "note": "Seeded from the posting guideline."},
        )
    for phrase in SCAM_PATTERNS:
        ScreeningRule.objects.get_or_create(
            phrase=phrase,
            defaults={"kind": "scam", "note": "Seeded from the posting guideline."},
        )


def unseed(apps, schema_editor):
    ScreeningRule = apps.get_model("screening", "ScreeningRule")
    ScreeningRule.objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [("screening", "0004_screeningrule")]
    operations = [migrations.RunPython(seed, unseed)]
