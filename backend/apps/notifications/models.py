"""One inbox row per event a member needs to see.

The row is written by the service that caused the event (an order transition, a
message, a comment, a report, a rating), so both sides see the same thing no
matter which browser they are on. `link_kind`/`link_id` let the topbar send the
reader to the right screen; the frontend bridge translates the id into the UI's
own id format.
"""

from django.conf import settings
from django.db import models


class Notification(models.Model):
    class Kind(models.TextChoices):
        ORDER = "order", "Order"
        MESSAGE = "message", "Message"
        TICKET = "ticket", "Store ticket"
        COMMENT = "comment", "Forum comment"
        REPORT = "report", "Report"
        REVIEW = "review", "Review"
        LISTING = "listing", "Listing"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="notifications_sent",
    )
    kind = models.CharField(max_length=10, choices=Kind.choices)
    text = models.CharField(max_length=240)
    # UI link vocabulary: order, request, shop, message, post, freports,
    # reviews, listing, txn, baoorders, baoStock, approval.
    link_kind = models.CharField(max_length=12, blank=True)
    link_id = models.CharField(max_length=64, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "read_at", "-created_at"]),
        ]

    @property
    def is_read(self):
        return self.read_at is not None

    def __str__(self):
        return f"{self.user.email}: {self.text[:40]}"
