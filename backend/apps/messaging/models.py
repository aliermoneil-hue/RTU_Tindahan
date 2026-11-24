from django.conf import settings
from django.db import models

from apps.catalog.models import Listing


class Conversation(models.Model):
    """One thread between one buyer and one seller, optionally about a listing."""

    listing = models.ForeignKey(
        Listing,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="conversations",
    )
    buyer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="conversations_as_buyer",
    )
    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="conversations_as_seller",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["buyer", "seller"], name="one_thread_per_buyer_and_seller"
            ),
            models.CheckConstraint(
                condition=~models.Q(buyer=models.F("seller")),
                name="conversation_buyer_is_not_seller",
            ),
        ]

    def __str__(self):
        return f"{self.buyer.email} ↔ {self.seller.email}"

    @property
    def last_message_at(self):
        last = self.messages.order_by("-created_at").first()
        return last.created_at if last else self.created_at

    def unread_for(self, user):
        return self.messages.filter(read_at__isnull=True).exclude(sender=user).count()


class Message(models.Model):
    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name="messages"
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="messages_sent",
    )
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return self.body[:40]


class ConversationReport(models.Model):
    """MS-04 and MS-05: a participant reports a thread, and a moderator may read
    only the messages the report is about.

    The reported text is copied at report time (`snapshot_body`), so the
    moderator reviews exactly what was said when the report was filed, and the
    rest of a private conversation stays private — that is the whole point of
    MS-05, and why this model never points at a conversation's other messages.
    """

    class Reason(models.TextChoices):
        HARASSMENT = "harassment", "Harassment or threats"
        SCAM = "scam", "Scam or fraud"
        OFF_PLATFORM = "off_platform", "Payment outside the platform"
        PROHIBITED = "prohibited", "Prohibited item or service"
        SPAM = "spam", "Spam"
        OTHER = "other", "Something else"

    class Status(models.TextChoices):
        """RM-02: the same three states the forum reports use."""

        RECEIVED = "received", "Received"
        UNDER_REVIEW = "under_review", "Under Review"
        RESOLVED = "resolved", "Resolved"

    class Resolution(models.TextChoices):
        ACTIONED = "actioned", "Action taken"
        DISMISSED = "dismissed", "No action taken"

    class Action(models.TextChoices):
        DISMISS = "dismiss", "No action"
        WARN = "warn", "Warn the sender"
        SUSPEND = "suspend", "Suspend the sender"

    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name="reports"
    )
    # Null when the whole thread is reported rather than one message.
    message = models.ForeignKey(
        Message,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reports",
    )
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="conversation_reports_made",
    )
    reported_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="conversation_reports_against",
    )
    reason = models.CharField(max_length=14, choices=Reason.choices)
    details = models.TextField(blank=True, max_length=600)
    # What the moderator is allowed to read, and nothing beside it.
    snapshot_body = models.TextField(blank=True)
    snapshot_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.RECEIVED, db_index=True
    )
    action = models.CharField(max_length=10, choices=Action.choices, blank=True)
    # RM-02: the outcome, kept apart from the status so "Resolved" stays one word.
    resolution = models.CharField(max_length=12, choices=Resolution.choices, blank=True)
    handled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="conversation_reports_handled",
    )
    handled_at = models.DateTimeField(null=True, blank=True)
    note = models.TextField(blank=True, max_length=600)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "-created_at"]),
            models.Index(fields=["reported_user", "-created_at"]),
        ]

    def __str__(self):
        return f"report {self.pk} ({self.reason}, {self.status})"

    @property
    def is_thread_report(self) -> bool:
        return self.message_id is None
