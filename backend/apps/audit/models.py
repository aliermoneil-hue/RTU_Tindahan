"""Who did what, in the order it happened.

Rows are written only by staff actions: account status and role changes,
listing moderation, forum moderation and report decisions. Member activity is
already represented by its own tables, so it does not belong here.

The log is append-only by design: there is no update or delete endpoint, and an
entry names its target even after the target row is gone.
"""

from django.conf import settings
from django.db import models


class AuditLog(models.Model):
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="audit_entries",
    )
    # "suspend user", "approve listing", "hide forum post", …
    action = models.CharField(max_length=60)
    target_type = models.CharField(max_length=30)
    target_id = models.CharField(max_length=64, blank=True)
    target_name = models.CharField(max_length=150, blank=True)
    note = models.CharField(max_length=300, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["-created_at"]),
            models.Index(fields=["action", "-created_at"]),
            models.Index(fields=["target_type", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.actor} {self.action} {self.target_type} {self.target_id}"
