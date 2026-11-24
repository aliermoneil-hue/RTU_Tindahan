"""Appeals: a person's second chance at a decision that went against them.

AI-06 asks for an appeal after a moderator confirms a rejection; RM-08 asks for
one after a removal, a warning or a suspension. The two are the same shape — a
decision, a person who disagrees with it, and a reviewer who is not the person
who made it — so there is one model and one workflow, with the target naming
what is being appealed.

The rules that matter are enforced here rather than in the views:

- only the owner of the thing may appeal it, and only while it is actually in
  the state they are appealing (a rejected listing, a hidden post or comment, a
  suspended account);
- one open appeal per target: a queue full of the same grievance helps nobody;
- the reviewer cannot be the appellant and cannot be the person who made the
  original decision, which is the sentence both requirements spell out;
- a decision carries a reason, because a refusal with no reason is how people
  lose faith in a moderation system.
"""

from django.conf import settings
from django.db import models


class Appeal(models.Model):
    class Kind(models.TextChoices):
        LISTING = "listing", "A listing was rejected"
        POST = "post", "A forum post was removed"
        COMMENT = "comment", "A forum comment was removed"
        ACCOUNT = "account", "My account was suspended"

    class Status(models.TextChoices):
        PENDING = "pending", "Waiting for review"
        GRANTED = "granted", "Granted"
        DENIED = "denied", "Denied"

    appellant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="appeals_made",
    )
    kind = models.CharField(max_length=10, choices=Kind.choices)
    listing = models.ForeignKey(
        "catalog.Listing",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="appeals",
    )
    post = models.ForeignKey(
        "forum.ForumPost",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="appeals",
    )
    comment = models.ForeignKey(
        "forum.ForumComment",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="appeals",
    )
    # Captured when the appeal is filed, so the separation rule survives a
    # later change to the item: whoever decided against this person then is the
    # one person who may not decide the appeal now.
    original_decider = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="decisions_appealed",
    )
    reason = models.TextField(max_length=1000)
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.PENDING, db_index=True
    )
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="appeals_decided",
    )
    decided_at = models.DateTimeField(null=True, blank=True)
    decision_note = models.TextField(blank=True, max_length=600)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["appellant", "-created_at"]),
            models.Index(fields=["status", "-created_at"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(listing__isnull=False, post__isnull=True, comment__isnull=True)
                    | models.Q(listing__isnull=True, post__isnull=False, comment__isnull=True)
                    | models.Q(listing__isnull=True, post__isnull=True, comment__isnull=False)
                    | models.Q(listing__isnull=True, post__isnull=True, comment__isnull=True)
                ),
                name="appeal_at_most_one_target",
            )
        ]

    def __str__(self):
        return f"appeal {self.pk} ({self.kind}, {self.status})"

    @property
    def target_label(self) -> str:
        if self.kind == self.Kind.LISTING and self.listing_id:
            return self.listing.title
        if self.kind == self.Kind.POST and self.post_id:
            return self.post.title or (self.post.body or "")[:60]
        if self.kind == self.Kind.COMMENT and self.comment_id:
            return (self.comment.text or "")[:60]
        if self.kind == self.Kind.ACCOUNT:
            return "My account"
        return ""
