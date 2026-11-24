# Renumbered to 0006 when Lian's lockout branch merged: main had already
# taken 0003 (password reset code), 0004 (colleges) and 0005 (status audit).

import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0005_user_status_changed_by"),
    ]

    operations = [
        migrations.CreateModel(
            name="LoginAttempt",
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
                    "email",
                    models.EmailField(
                        db_index=True,
                        help_text="Login address that failed, stored lowercased.",
                        max_length=254,
                        unique=True,
                        verbose_name="email address",
                    ),
                ),
                (
                    "failed_count",
                    models.PositiveSmallIntegerField(default=0),
                ),
                (
                    "last_failed_at",
                    models.DateTimeField(blank=True, null=True),
                ),
                (
                    "locked_until",
                    models.DateTimeField(blank=True, null=True),
                ),
                (
                    "updated_at",
                    models.DateTimeField(auto_now=True),
                ),
            ],
            options={
                "verbose_name": "login attempt",
                "verbose_name_plural": "login attempts",
                "ordering": ["-updated_at"],
            },
        ),
    ]
