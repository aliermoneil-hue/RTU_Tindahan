"""RM-02 for conversation reports: the same three statuses as the forum's.

  open      -> received
  dismissed -> resolved + resolution "dismissed"
  actioned  -> resolved + resolution "actioned"
"""

from django.db import migrations

FORWARD = {
    "open": ("received", ""),
    "dismissed": ("resolved", "dismissed"),
    "actioned": ("resolved", "actioned"),
}

BACKWARD = {
    ("received", ""): "open",
    ("resolved", "dismissed"): "dismissed",
    ("resolved", "actioned"): "actioned",
}


def forwards(apps, schema_editor):
    ConversationReport = apps.get_model("messaging", "ConversationReport")
    for status, (new_status, resolution) in FORWARD.items():
        ConversationReport.objects.filter(status=status).update(
            status=new_status, resolution=resolution
        )


def backwards(apps, schema_editor):
    ConversationReport = apps.get_model("messaging", "ConversationReport")
    for (status, resolution), old_status in BACKWARD.items():
        ConversationReport.objects.filter(status=status, resolution=resolution).update(
            status=old_status
        )


class Migration(migrations.Migration):
    dependencies = [
        ("messaging", "0003_conversationreport_resolution_and_more"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
