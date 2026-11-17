"""Every screening decision, kept as an audit trail.

The verdict is stored here rather than on `Listing` so that the history of a
re-screened listing survives: a seller can edit an approved item, and a
moderator may need to see why it was flagged the first time.
"""

from django.db import models


class ScreeningResult(models.Model):
    """One screening run for one listing (AI-01 to AI-16)."""

    class Verdict(models.TextChoices):
        CLEAN = "clean", "Clean"
        FLAGGED = "flagged", "Flagged"

    listing = models.ForeignKey(
        "catalog.Listing",
        on_delete=models.CASCADE,
        related_name="screening_results",
    )
    verdict = models.CharField(max_length=10, choices=Verdict.choices, db_index=True)

    # 0 = certainly harmless, 100 = certainly prohibited. Null when the
    # provider could not be reached, which is a different thing from "clean".
    score = models.PositiveSmallIntegerField(null=True, blank=True)
    reasons = models.JSONField(default=list, blank=True)

    # Which implementation answered, so a verdict can be explained later.
    provider = models.CharField(max_length=40)
    model_name = models.CharField(max_length=80, blank=True)
    raw = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["listing", "-created_at"])]

    def __str__(self):
        return f"{self.listing_id}: {self.verdict}"

    @property
    def is_flagged(self) -> bool:
        return self.verdict == self.Verdict.FLAGGED
