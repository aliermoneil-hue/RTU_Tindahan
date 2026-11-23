"""Campus forum: posts, comments, reactions, and reports.

Moderation is soft: a hidden post or comment keeps its row (so a report can be
reviewed and the decision reversed), and a comment with replies is marked
deleted instead of disappearing from under the thread. Only a hard delete —
the author's own, or a moderator's remove action — removes rows.
"""

from django.conf import settings
from django.db import models


class ForumPost(models.Model):
    class Kind(models.TextChoices):
        POST = "post", "Member post"
        STUDENT = "student", "Student post"
        SCHOOL = "school", "School post"
        NOTICE = "notice", "Announcement"

    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.POST)
    topic = models.CharField(max_length=40, blank=True)
    title = models.CharField(max_length=120, blank=True)
    body = models.TextField(blank=True)
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="forum_posts",
    )
    # Storage names, not URLs: the serializer builds absolute media URLs.
    images = models.JSONField(default=list, blank=True)
    pinned = models.BooleanField(default=False)
    hidden_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="forum_posts_hidden",
    )
    hidden_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    edited_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-pinned", "-created_at"]
        indexes = [
            models.Index(fields=["-pinned", "-created_at"]),
            models.Index(fields=["topic", "-created_at"]),
        ]

    @property
    def is_hidden(self):
        return self.hidden_at is not None

    def __str__(self):
        return self.title or self.body[:40] or f"Post {self.pk}"


class ForumComment(models.Model):
    post = models.ForeignKey(ForumPost, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="forum_comments",
    )
    text = models.TextField(blank=True)
    parent = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="replies",
    )
    deleted_at = models.DateTimeField(null=True, blank=True)
    hidden_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="forum_comments_hidden",
    )
    hidden_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    edited_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [models.Index(fields=["post", "created_at"])]

    @property
    def is_deleted(self):
        return self.deleted_at is not None

    @property
    def is_hidden(self):
        return self.hidden_at is not None

    def __str__(self):
        return self.text[:40] or f"Comment {self.pk}"


class ForumReaction(models.Model):
    """One reaction per member per post; a new choice replaces the old one."""

    KEYS = ("like", "love", "haha", "wow", "sad")

    post = models.ForeignKey(ForumPost, on_delete=models.CASCADE, related_name="reactions")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="forum_reactions"
    )
    key = models.CharField(max_length=10)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["post", "user"], name="forum_one_reaction_per_member")
        ]

    def __str__(self):
        return f"{self.user} {self.key} {self.post_id}"


class ForumReport(models.Model):
    class Type(models.TextChoices):
        POST = "post", "Post"
        COMMENT = "comment", "Comment"
        ORDER = "order", "Order"

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        REVIEWED = "reviewed", "Reviewed"
        DISMISSED = "dismissed", "Dismissed"
        ACTIONED = "actioned", "Actioned"

    type = models.CharField(max_length=10, choices=Type.choices)
    post = models.ForeignKey(
        ForumPost, null=True, blank=True, on_delete=models.CASCADE, related_name="reports"
    )
    comment = models.ForeignKey(
        ForumComment, null=True, blank=True, on_delete=models.CASCADE, related_name="reports"
    )
    order = models.ForeignKey(
        "orders.Order",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="reports",
    )
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="forum_reports"
    )
    reason = models.CharField(max_length=80)
    details = models.TextField(blank=True)
    # What the moderator saw when the report was filed, kept even if the
    # content is later edited or deleted.
    snapshot_title = models.CharField(max_length=200, blank=True)
    snapshot_text = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.OPEN)
    handled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="forum_reports_handled",
    )
    handled_at = models.DateTimeField(null=True, blank=True)
    action = models.CharField(max_length=10, blank=True)
    note = models.CharField(max_length=300, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "-created_at"])]
        constraints = [
            models.UniqueConstraint(
                fields=["reporter", "post", "comment"],
                condition=models.Q(post__isnull=False),
                name="forum_one_report_per_member_per_item",
            )
        ]

    def __str__(self):
        return f"{self.type} report by {self.reporter} ({self.status})"
