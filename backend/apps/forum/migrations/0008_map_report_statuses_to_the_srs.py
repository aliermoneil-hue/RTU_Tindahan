"""RM-02: move the old four statuses onto the SRS's three, keeping the outcome.

Old vocabulary          New
  open                  received
  reviewed              under_review
  dismissed             resolved + resolution "dismissed"
  actioned              resolved + resolution "actioned"

The reverse is lossy on purpose: returning to the old names cannot tell a
reviewed report from one that was never opened, so it maps back what it can.
"""

from django.db import migrations

FORWARD = {
    "open": ("received", ""),
    "reviewed": ("under_review", ""),
    "dismissed": ("resolved", "dismissed"),
    "actioned": ("resolved", "actioned"),
}

BACKWARD = {
    ("received", ""): "open",
    ("under_review", ""): "reviewed",
    ("resolved", "dismissed"): "dismissed",
    ("resolved", "actioned"): "actioned",
}


def forwards(apps, schema_editor):
    ForumReport = apps.get_model("forum", "ForumReport")
    for status, (new_status, resolution) in FORWARD.items():
        ForumReport.objects.filter(status=status).update(
            status=new_status, resolution=resolution
        )


def backwards(apps, schema_editor):
    ForumReport = apps.get_model("forum", "ForumReport")
    for (status, resolution), old_status in BACKWARD.items():
        ForumReport.objects.filter(status=status, resolution=resolution).update(
            status=old_status
        )


class Migration(migrations.Migration):
    dependencies = [
        ("forum", "0007_forumreport_resolution_alter_forumreport_status"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
