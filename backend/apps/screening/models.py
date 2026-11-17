"""Storage for screening: the log (AI-08) and the accuracy record (AI-15)."""

from django.conf import settings
from django.db import models
from django.utils import timezone

from .services import APPROVED, NEEDS_REVIEW, REJECTED


class ScreeningLog(models.Model):
    """AI-08: one row per screening, with the exact text that left the server.

    Content IDs are deliberately loose (`content_type` + object id) because
    AI-01 covers listings, forum posts, comments, and reviews.
    """

    OUTCOME_CHOICES = [
        (APPROVED, "Approved"),
        (NEEDS_REVIEW, "Needs review"),
        (REJECTED, "Rejected"),
    ]

    class ContentType(models.TextChoices):
        LISTING = "listing", "Listing"
        FORUM_POST = "forum_post", "Forum post"
        COMMENT = "comment", "Comment"
        REVIEW = "review", "Review"

    content_type = models.CharField(
        max_length=20, choices=ContentType.choices, default=ContentType.LISTING
    )
    object_id = models.PositiveBigIntegerField(null=True, blank=True, db_index=True)
    cleaned_text = models.TextField(
        help_text="Exactly what was sent to the provider, after AI-09 scrubbing."
    )
    outcome = models.CharField(max_length=20, choices=OUTCOME_CHOICES, db_index=True)
    reason = models.TextField(blank=True)
    confidence = models.FloatField(default=0.0)
    provider = models.CharField(max_length=40, blank=True)
    rules_version = models.CharField(max_length=40, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["content_type", "object_id"])]

    def __str__(self):
        return f"{self.get_content_type_display()} #{self.object_id}: {self.outcome}"


class ModerationDecision(models.Model):
    """AI-11 and AI-15: the moderator's final call, stored beside the AI verdict.

    Keeping both lets the team measure accuracy, precision, and recall later
    without re-running anything.
    """

    class Decision(models.TextChoices):
        CONFIRMED = "confirmed", "Confirmed the AI result"
        REVERSED = "reversed", "Reversed the AI result"

    log = models.OneToOneField(
        ScreeningLog, on_delete=models.CASCADE, related_name="decision"
    )
    moderator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="screening_decisions",
    )
    decision = models.CharField(max_length=20, choices=Decision.choices)
    final_outcome = models.CharField(max_length=20, choices=ScreeningLog.OUTCOME_CHOICES)
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.decision} on log #{self.log_id}"

    @property
    def agreed_with_ai(self) -> bool:
        return self.final_outcome == self.log.outcome


class ScreeningRule(models.Model):
    """AI-10: an Administrator can change the rules without touching code."""

    term = models.CharField(max_length=120, unique=True)
    outcome = models.CharField(
        max_length=20, choices=ScreeningLog.OUTCOME_CHOICES, default=REJECTED
    )
    is_active = models.BooleanField(default=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="screening_rules",
    )
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["term"]

    def __str__(self):
        return f"{self.term} -> {self.outcome}"

    def save(self, *args, **kwargs):
        self.term = self.term.strip().casefold()
        if not self.created_at:
            self.created_at = timezone.now()
        super().save(*args, **kwargs)
