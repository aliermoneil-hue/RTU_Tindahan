"""Every screening decision, kept as an audit trail.

The verdict is stored here rather than on `Listing` so that the history of a
re-screened listing survives: a seller can edit an approved item, and a
moderator may need to see why it was flagged the first time.
"""

from django.conf import settings
from django.db import models


class ScreeningResult(models.Model):
    """One screening run for one listing (AI-01 to AI-16)."""

    class Verdict(models.TextChoices):
        CLEAN = "clean", "Clean"
        FLAGGED = "flagged", "Flagged"
        # AI-11: a definite violation. It is not final — the item sits in the
        # moderator queue until a person confirms or reverses it.
        REJECTED = "rejected", "Rejected"

    class Decision(models.TextChoices):
        PENDING = "", "Awaiting a moderator"
        CONFIRMED = "confirmed", "Confirmed by a moderator"
        REVERSED = "reversed", "Reversed by a moderator"

    listing = models.ForeignKey(
        "catalog.Listing",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="screening_results",
    )
    # A forum post is screened by the same providers and the same rules, so
    # its verdict lives in the same table. The two targets are exclusive:
    # a row is either a listing's verdict or a post's, never both.
    post = models.ForeignKey(
        "forum.ForumPost",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="screening_results",
    )
    # Comments are screened by the same providers; the audit row names the
    # comment when that is what was judged.
    comment = models.ForeignKey(
        "forum.ForumComment",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="screening_results",
    )
    # RR-06: an edited review is screened too, and the audit row names it.
    review = models.ForeignKey(
        "reviews.Review",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="screening_results",
    )
    verdict = models.CharField(max_length=10, choices=Verdict.choices, db_index=True)

    # 0 = certainly harmless, 100 = certainly prohibited. Null when the
    # provider could not be reached, which is a different thing from "clean".
    score = models.PositiveSmallIntegerField(null=True, blank=True)
    reasons = models.JSONField(default=list, blank=True)

    # AI-12: what the provider thought of its own answer. Null on rows written
    # before this field existed, and on a provider error where there is nothing
    # to be confident about.
    confidence = models.FloatField(null=True, blank=True)

    # AI-11 and AI-15: the moderator's final decision, recorded next to the AI's
    # so the two can be compared (accuracy, precision, recall).
    decision = models.CharField(
        max_length=10,
        choices=Decision.choices,
        default=Decision.PENDING,
        blank=True,
        db_index=True,
    )
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="screening_decisions",
    )
    decided_at = models.DateTimeField(null=True, blank=True)
    decision_note = models.CharField(max_length=300, blank=True)

    # Which implementation answered, so a verdict can be explained later.
    provider = models.CharField(max_length=40)
    model_name = models.CharField(max_length=80, blank=True)
    raw = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["listing", "-created_at"]),
            models.Index(fields=["post", "-created_at"]),
            models.Index(fields=["comment", "-created_at"]),
            models.Index(fields=["review", "-created_at"]),
        ]
        constraints = [
            models.CheckConstraint(
                name="screening_result_exactly_one_target",
                condition=(
                    models.Q(
                        listing__isnull=False, post__isnull=True, comment__isnull=True, review__isnull=True
                    )
                    | models.Q(
                        listing__isnull=True, post__isnull=False, comment__isnull=True, review__isnull=True
                    )
                    | models.Q(
                        listing__isnull=True, post__isnull=True, comment__isnull=False, review__isnull=True
                    )
                    | models.Q(
                        listing__isnull=True, post__isnull=True, comment__isnull=True, review__isnull=False
                    )
                ),
            )
        ]

    def __str__(self):
        return f"{self.target_label}: {self.verdict}"

    @property
    def target_label(self):
        if self.listing_id:
            return f"listing {self.listing_id}"
        if self.post_id:
            return f"post {self.post_id}"
        if self.comment_id:
            return f"comment {self.comment_id}"
        if self.review_id:
            return f"review {self.review_id}"
        return "unattached result"

    @property
    def is_flagged(self) -> bool:
        return self.verdict == self.Verdict.FLAGGED


class ScreeningRule(models.Model):
    """AI-10: a screening term an administrator can change without a deploy.

    The list used to live in `providers.py`, which meant that adding a word a
    seller had found a way around required a code change, a test run and a
    release. It lives here now; the code's original list is the seeded default,
    so an empty or wiped table still screens the way it shipped.

    `kind` separates the two lists that behave differently: a `prohibited` term
    on its own is enough to flag (score 90), while a `scam` term describes a
    pay-first pattern (score 85, listing text only).
    """

    class Kind(models.TextChoices):
        PROHIBITED = "prohibited", "Prohibited item or content"
        SCAM = "scam", "Scam pattern"

    phrase = models.CharField(max_length=120, unique=True)
    kind = models.CharField(max_length=12, choices=Kind.choices, default=Kind.PROHIBITED)
    note = models.CharField(max_length=200, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="screening_rules_added",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["kind", "phrase"]

    def __str__(self):
        return f"{self.kind}: {self.phrase}"
