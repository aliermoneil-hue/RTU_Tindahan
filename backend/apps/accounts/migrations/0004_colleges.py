"""Turn the free-text college on the account into a proper lookup table.

Before this migration a college was a string on each user row, so the same unit
was stored under several spellings ("College of Information and Communications
Technology", "BS Information Technology", "College of ICT") and any report
grouped by it was quietly wrong. This creates College + CollegeAlias, folds the
known synonyms onto one row, links every existing account, and only then drops
the text column.
"""

import django.db.models.deletion
from django.db import migrations, models


# Spellings that are known to mean the same unit. Anything not listed is turned
# into its own row so no data is lost; an administrator can merge those later in
# the admin by moving aliases.
CANONICAL = {
    "college of information and communications technology": {
        "code": "CICT",
        "kind": "college",
        "sort_order": 10,
        "name": "College of Information and Communications Technology",
        "aliases": [
            "bs information technology",
            "bsit",
            "college of ict",
            "cict",
            "information technology",
        ],
    },
    "office of student affairs": {
        "code": "OSA",
        "kind": "office",
        "sort_order": 40,
        "name": "Office of Student Affairs",
        "aliases": ["osa", "student affairs", "student affairs office"],
    },
    "administration": {
        "code": "ADMIN",
        "kind": "administration",
        "sort_order": 50,
        "name": "Administration",
        "aliases": ["admin", "administration office"],
    },
}


def normalize(text):
    return " ".join(str(text or "").split()).casefold()


def forwards(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    College = apps.get_model("accounts", "College")
    CollegeAlias = apps.get_model("accounts", "CollegeAlias")

    by_key = {}

    def remember(key, place):
        if key:
            by_key[key] = place

    for key, spec in CANONICAL.items():
        place, _ = College.objects.get_or_create(
            name=spec["name"],
            defaults={
                "code": spec["code"],
                "kind": spec["kind"],
                "sort_order": spec["sort_order"],
            },
        )
        remember(key, place)
        remember(normalize(spec["name"]), place)
        if spec["code"]:
            remember(normalize(spec["code"]), place)
        for alias in spec["aliases"]:
            CollegeAlias.objects.get_or_create(
                text=normalize(alias), defaults={"college": place}
            )
            # The synonym must also resolve when linking the rows that already
            # exist, not only for future lookups.
            remember(normalize(alias), place)

    # Every other spelling already present in the data keeps its meaning as its
    # own row rather than being silently dropped.
    existing = (
        User.objects.exclude(college__isnull=True)
        .exclude(college="")
        .values_list("college", flat=True)
        .distinct()
    )
    for value in list(existing):
        key = normalize(value)
        if not key or key in by_key:
            continue
        place, _ = College.objects.get_or_create(
            name=" ".join(str(value).split()), defaults={"code": None}
        )
        remember(key, place)

    for user in User.objects.all().iterator():
        key = normalize(user.college)
        place = by_key.get(key)
        if place is not None:
            user.college_ref_id = place.pk
            user.save(update_fields=["college_ref"])


def backwards(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    for user in User.objects.select_related("college_ref").iterator():
        place = user.college_ref
        user.college = place.name if place is not None else ""
        user.save(update_fields=["college"])


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0003_passwordresetcode"),
    ]

    operations = [
        migrations.CreateModel(
            name="College",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "code",
                    models.CharField(
                        blank=True,
                        help_text=(
                            "Short code such as CICT. Left blank for places added "
                            "by fixtures."
                        ),
                        max_length=24,
                        null=True,
                        unique=True,
                    ),
                ),
                ("name", models.CharField(max_length=150, unique=True)),
                (
                    "kind",
                    models.CharField(
                        choices=[
                            ("college", "College"),
                            ("institute", "Institute"),
                            ("office", "Office"),
                            ("administration", "Administration"),
                        ],
                        default="college",
                        max_length=20,
                    ),
                ),
                ("is_active", models.BooleanField(default=True)),
                ("sort_order", models.PositiveSmallIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "college / office",
                "verbose_name_plural": "colleges / offices",
                "ordering": ["sort_order", "name"],
                "indexes": [
                    models.Index(
                        fields=["is_active", "sort_order"],
                        name="accounts_co_is_acti_7f0b44_idx",
                    )
                ],
            },
        ),
        migrations.CreateModel(
            name="CollegeAlias",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("text", models.CharField(max_length=150, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "college",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="aliases",
                        to="accounts.college",
                    ),
                ),
            ],
            options={
                "verbose_name": "college alias",
                "verbose_name_plural": "college aliases",
                "ordering": ["text"],
            },
        ),
        migrations.AddField(
            model_name="user",
            name="college_ref",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="+",
                to="accounts.college",
            ),
        ),
        migrations.RunPython(forwards, backwards),
        migrations.RemoveField(
            model_name="user",
            name="college",
        ),
        migrations.RenameField(
            model_name="user",
            old_name="college_ref",
            new_name="college",
        ),
        migrations.AlterField(
            model_name="user",
            name="college",
            field=models.ForeignKey(
                blank=True,
                help_text="One row per college, institute or office — not free text.",
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="members",
                to="accounts.college",
                verbose_name="College / Institute / Office",
            ),
        ),
    ]
