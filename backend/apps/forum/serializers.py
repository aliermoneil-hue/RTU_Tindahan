import base64
import binascii
import re
import uuid

from django.utils import timezone
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from rest_framework import serializers

from apps.accounts.models import User
from apps.catalog.models import Listing
from apps.reviews.models import Review
from apps.orders.models import Order

from .models import ForumComment, ForumPost, ForumReaction, ForumReport

IMAGE_TYPES = {"jpeg": "jpg", "jpg": "jpg", "png": "png", "webp": "webp"}
MAX_IMAGES = 4
MAX_IMAGE_BYTES = 2 * 1024 * 1024


def short_name(user):
    name = (getattr(user, "display_name", "") or getattr(user, "email", "") or "").strip()
    return name.split(" ")[0] if name else "Member"


def save_images(data_urls, request):
    """Decode the browser's data URLs into media files; return storage names.

    The forum composer already downscales before it hands over a data URL, so
    the cap here is a backstop against a crafted request, not the normal path.
    """
    if not data_urls:
        return []
    if len(data_urls) > MAX_IMAGES:
        raise serializers.ValidationError(f"At most {MAX_IMAGES} photos per post.")

    saved = []
    for raw in data_urls:
        match = re.match(r"^data:image/([a-zA-Z]+);base64,(.+)$", raw or "", re.DOTALL)
        if not match:
            raise serializers.ValidationError("Each photo must be an image data URL.")
        kind = match.group(1).lower()
        if kind not in IMAGE_TYPES:
            raise serializers.ValidationError("Photos must be JPEG, PNG or WebP.")
        try:
            payload = base64.b64decode(match.group(2), validate=True)
        except (binascii.Error, ValueError):
            raise serializers.ValidationError("A photo could not be decoded.")
        if len(payload) > MAX_IMAGE_BYTES:
            raise serializers.ValidationError("Each photo must be 2 MB or smaller.")
        # SE-04/SE-06: decode the pixels and write a fresh JPEG, so EXIF (where
        # the photo was taken) and any polyglot payload do not survive storage.
        from apps.catalog.photos import clean_photo

        cleaned = clean_photo(ContentFile(payload))
        name = f"forum/{uuid.uuid4().hex}.jpg"
        saved.append(default_storage.save(name, cleaned))
    return saved


def image_urls(names, request):
    urls = []
    for name in names or []:
        url = default_storage.url(name)
        urls.append(request.build_absolute_uri(url) if request else url)
    return urls


class ForumCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    author_role = serializers.SerializerMethodField()
    is_mine = serializers.SerializerMethodField()
    deleted = serializers.BooleanField(source="is_deleted", read_only=True)
    hidden = serializers.SerializerMethodField()
    screening = serializers.SerializerMethodField()

    class Meta:
        model = ForumComment
        fields = (
            "id",
            "author_name",
            "author_role",
            "is_mine",
            "text",
            "parent",
            "deleted",
            "hidden",
            "moderation_status",
            "screening",
            "created_at",
            "edited_at",
        )
        read_only_fields = fields

    def get_author_name(self, obj):
        return short_name(obj.author) if obj.author_id else "Former member"

    def get_author_role(self, obj):
        return getattr(obj.author, "role", "") if obj.author_id else ""

    def get_is_mine(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        return bool(user and user.is_authenticated and obj.author_id == user.id)

    def get_hidden(self, obj):
        if not obj.hidden_at:
            return None
        return {
            "by": short_name(obj.hidden_by) if obj.hidden_by_id else "Staff",
            "ts": obj.hidden_at,
        }

    def get_screening(self, obj):
        """Latest verdict for a comment, staff only (AI-03)."""
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not (user and user.is_authenticated and getattr(user, "is_moderator", False)):
            return None

        latest = next(iter(obj.screening_results.all()), None)
        if latest is None:
            return None
        return {
            "verdict": latest.verdict,
            "score": latest.score,
            "reasons": latest.reasons,
            "provider": latest.provider,
            "model": latest.model_name,
            # AI-08/AI-09: the text the model read, and the details removed first.
            "screened_text": latest.screened_text,
            "redactions": latest.redactions,
            "images_checked": latest.images_checked,
            "at": latest.created_at,
        }


class ForumPostSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    author_role = serializers.SerializerMethodField()
    is_mine = serializers.SerializerMethodField()
    images = serializers.SerializerMethodField()
    hidden = serializers.SerializerMethodField()
    screening = serializers.SerializerMethodField()
    comments = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()
    react_counts = serializers.SerializerMethodField()
    my_reaction = serializers.SerializerMethodField()

    class Meta:
        model = ForumPost
        fields = (
            "id",
            "kind",
            "topic",
            "title",
            "body",
            "event_date",
            "event_start",
            "event_end",
            "event_place",
            "author_name",
            "author_role",
            "is_mine",
            "images",
            "pinned",
            "hidden",
            "moderation_status",
            "screening",
            "comments",
            "comment_count",
            "react_counts",
            "my_reaction",
            "created_at",
            "edited_at",
        )
        read_only_fields = fields

    def get_author_name(self, obj):
        if obj.author_id:
            return short_name(obj.author)
        return "Office of Student Affairs" if obj.kind == ForumPost.Kind.NOTICE else "RTU"

    def get_author_role(self, obj):
        return getattr(obj.author, "role", "") if obj.author_id else ""

    def get_is_mine(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        return bool(user and user.is_authenticated and obj.author_id == user.id)

    def get_images(self, obj):
        return image_urls(obj.images, self.context.get("request"))

    def get_hidden(self, obj):
        if not obj.hidden_at:
            return None
        return {
            "by": short_name(obj.hidden_by) if obj.hidden_by_id else "Staff",
            "ts": obj.hidden_at,
        }

    def visible_comments(self, obj):
        """Comments this caller may read: a held one only for its author, and
        for staff — the same rule posts get, so nothing vanishes silently."""
        request = self.context.get("request")
        user = getattr(request, "user", None)
        staff = bool(
            user and user.is_authenticated and getattr(user, "is_moderator", False)
        )
        comments = list(obj.comments.select_related("author", "hidden_by"))
        if staff:
            return comments
        if user and user.is_authenticated:
            return [c for c in comments if not c.is_held or c.author_id == user.id]
        return [c for c in comments if not c.is_held]

    def get_comments(self, obj):
        return ForumCommentSerializer(
            self.visible_comments(obj), many=True, context=self.context
        ).data

    def get_screening(self, obj):
        """Latest screening verdict, for staff only (AI-03).

        The author learns the outcome from `moderation_status` and from their
        inbox, never from the reasons: a flagged post's reasons are written for
        a moderator and can name exactly which rule was tripped.
        """
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not (user and user.is_authenticated and getattr(user, "is_moderator", False)):
            return None

        latest = next(iter(obj.screening_results.all()), None)
        if latest is None:
            return None
        return {
            "verdict": latest.verdict,
            "score": latest.score,
            "reasons": latest.reasons,
            "provider": latest.provider,
            "model": latest.model_name,
            # AI-08/AI-09: the text the model read, and the details removed first.
            "screened_text": latest.screened_text,
            "redactions": latest.redactions,
            "images_checked": latest.images_checked,
            "at": latest.created_at,
        }

    def get_comment_count(self, obj):
        return sum(1 for c in self.visible_comments(obj) if not c.is_deleted and not c.is_hidden)

    def get_react_counts(self, obj):
        counts = {}
        for reaction in obj.reactions.all():
            counts[reaction.key] = counts.get(reaction.key, 0) + 1
        return counts

    def get_my_reaction(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not (user and user.is_authenticated):
            return None
        for reaction in obj.reactions.all():
            if reaction.user_id == user.id:
                return reaction.key
        return None


SELLING_SCHEDULE_TOPICS = {"selling schedule", "selling-schedule", "selling schedules"}


class ForumPostWriteSerializer(serializers.ModelSerializer):
    images = serializers.ListField(
        child=serializers.CharField(allow_blank=False), required=False, write_only=True
    )

    class Meta:
        model = ForumPost
        fields = (
            "kind",
            "topic",
            "title",
            "body",
            "images",
            "event_date",
            "event_start",
            "event_end",
            "event_place",
        )

    def validate_event_date(self, value):
        """CF-05: a schedule for a day that has passed is not a schedule."""
        if value and value < timezone.localdate():
            raise serializers.ValidationError(
                "A selling schedule cannot be set in the past. Pick today or a later day."
            )
        return value

    def validate(self, attrs):
        title = (attrs.get("title") or "").strip()
        body = (attrs.get("body") or "").strip()
        images = attrs.get("images") or []
        if not title and not body and not images:
            raise serializers.ValidationError("Write something or add a photo first.")
        if len(title) > 120:
            raise serializers.ValidationError("The title is limited to 120 characters.")
        if len(body) > 2000:
            raise serializers.ValidationError("The post is limited to 2000 characters.")
        attrs["title"] = title
        attrs["body"] = body

        # CF-05: the Selling schedule topic is an appointment, so the server —
        # not only the form — insists on the day, the time and the place.
        topic = (attrs.get("topic") or "").strip().lower()
        if topic in SELLING_SCHEDULE_TOPICS:
            missing = []
            if not attrs.get("event_date"):
                missing.append("a date")
            if not attrs.get("event_start"):
                missing.append("a start time")
            if not (attrs.get("event_place") or "").strip():
                missing.append("a campus location")
            if missing:
                if len(missing) == 1:
                    phrase = missing[0]
                elif len(missing) == 2:
                    phrase = f"{missing[0]} and {missing[1]}"
                else:
                    phrase = f"{', '.join(missing[:-1])} and {missing[-1]}"
                raise serializers.ValidationError(
                    f"A selling schedule needs {phrase}."
                )
            start = attrs.get("event_start")
            end = attrs.get("event_end")
            if start and end and end <= start:
                raise serializers.ValidationError(
                    {"event_end": "The end time must be after the start time."}
                )
            attrs["event_place"] = (attrs.get("event_place") or "").strip()
        return attrs


class ForumCommentWriteSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=500)
    parent = serializers.IntegerField(required=False, allow_null=True)

    def validate_text(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Write a comment first.")
        return value


class ForumReactSerializer(serializers.Serializer):
    key = serializers.ChoiceField(choices=ForumReaction.KEYS)


class ForumModerateSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=("hide", "restore", "pin", "unpin", "delete"))
    note = serializers.CharField(max_length=300, required=False, allow_blank=True)


class ForumReportWriteSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=ForumReport.Type.choices)
    post = serializers.PrimaryKeyRelatedField(
        queryset=ForumPost.objects.all(), required=False, allow_null=True
    )
    comment = serializers.PrimaryKeyRelatedField(
        queryset=ForumComment.objects.all(), required=False, allow_null=True
    )
    order = serializers.SlugRelatedField(
        slug_field="reference", queryset=Order.objects.all(), required=False, allow_null=True
    )
    listing = serializers.SlugRelatedField(
        slug_field="slug",
        queryset=Listing.objects.all(),
        required=False,
        allow_null=True,
    )
    # By email, because that is what the screen knows about a seller: the
    # listing carries the owner's address, not their database id.
    reported_user = serializers.SlugRelatedField(
        slug_field="email", queryset=User.objects.all(), required=False, allow_null=True
    )
    review = serializers.PrimaryKeyRelatedField(
        queryset=Review.objects.all(), required=False, allow_null=True
    )
    reason = serializers.CharField(max_length=80)
    details = serializers.CharField(max_length=400, required=False, allow_blank=True)

    def validate(self, attrs):
        request = self.context["request"]
        kind = attrs["type"]
        post = attrs.get("post")
        comment = attrs.get("comment")
        order = attrs.get("order")
        user = request.user

        if kind == ForumReport.Type.ORDER:
            if order is None:
                raise serializers.ValidationError("Choose the order this report is about.")
            if user.id not in (order.buyer_id, order.seller_id):
                raise serializers.ValidationError("You can only report your own order.")
            attrs["snapshot_title"] = f"Order {order.reference}"
            attrs["snapshot_text"] = attrs.get("details", "")
            return attrs

        # RM-01: a listing, reported by anyone who can see it and not by its
        # own seller; the snapshot is the title and description the moderator
        # will judge, taken now so a later edit cannot change the evidence.
        if kind == ForumReport.Type.LISTING:
            listing = attrs.get("listing")
            if listing is None:
                raise serializers.ValidationError("Choose the listing you are reporting.")
            if listing.seller_id == user.id:
                raise serializers.ValidationError("You cannot report your own listing.")
            attrs["snapshot_title"] = listing.title
            attrs["snapshot_text"] = listing.description
            return attrs

        # RM-01: a review, reported by anyone but its author. The stars and the
        # words are copied now: a review can be edited after it is reported.
        if kind == ForumReport.Type.REVIEW:
            review = attrs.get("review")
            if review is None:
                raise serializers.ValidationError("Choose the review you are reporting.")
            if review.buyer_id == user.id:
                raise serializers.ValidationError("You cannot report your own review.")
            attrs["snapshot_title"] = f"{review.stars}-star review"
            attrs["snapshot_text"] = review.text
            return attrs

        # RM-01: a member, reported by someone else. RM-07 then keeps the
        # reporter's name off the reported member's screen.
        if kind == ForumReport.Type.USER:
            target = attrs.get("reported_user")
            if target is None:
                raise serializers.ValidationError("Choose the member you are reporting.")
            if target.id == user.id:
                raise serializers.ValidationError("You cannot report yourself.")
            attrs["snapshot_title"] = target.display_name or target.email
            attrs["snapshot_text"] = attrs.get("details", "")
            return attrs

        if comment is not None:
            if comment.post_id != (post.id if post else None):
                raise serializers.ValidationError("That comment is not on this post.")
            target_author = comment.author_id
            snapshot_text = comment.text
        elif post is not None:
            target_author = post.author_id
            snapshot_text = post.body
        else:
            raise serializers.ValidationError("Choose the post or comment you are reporting.")

        if target_author == user.id:
            raise serializers.ValidationError("You cannot report your own content.")
        if ForumReport.objects.filter(
            reporter=user, post=post, comment=comment, status=ForumReport.Status.RECEIVED
        ).exists():
            raise serializers.ValidationError("You already reported this.")

        attrs["snapshot_title"] = (
            post.title or post.body[:70] or "Untitled post"
        ) if post else "Comment"
        attrs["snapshot_text"] = (snapshot_text or "")[:300]
        return attrs


class ForumReportSerializer(serializers.ModelSerializer):
    reporter_name = serializers.SerializerMethodField()
    is_mine = serializers.SerializerMethodField()
    post = serializers.IntegerField(source="post_id", read_only=True)
    comment = serializers.IntegerField(source="comment_id", read_only=True)
    order = serializers.SerializerMethodField()
    listing = serializers.SerializerMethodField()
    reported_user = serializers.SerializerMethodField()
    review = serializers.SerializerMethodField()
    target_name = serializers.SerializerMethodField()
    # RM-06: staff open a member's history from the row, so the row needs the
    # address of the member it is about. It is the reported member's, never the
    # reporter's, and it is withheld from everyone who is not staff (RM-07).
    target_email = serializers.SerializerMethodField()
    handled_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ForumReport
        fields = (
            "id",
            "type",
            "post",
            "comment",
            "order",
            "listing",
            "reported_user",
            "review",
            "reporter_name",
            "is_mine",
            "reason",
            "details",
            "snapshot_title",
            "snapshot_text",
            "status",
            # RM-02/RM-04: how a resolved report ended, so "Resolved" can say
            # whether anything was done without a fourth status.
            "resolution",
            "target_name",
            "target_email",
            "handled_by_name",
            "handled_at",
            "action",
            "note",
            "created_at",
        )
        read_only_fields = fields

    def get_reporter_name(self, obj):
        return short_name(obj.reporter)

    def get_order(self, obj):
        return obj.order.reference if obj.order_id else None

    def get_listing(self, obj):
        return obj.listing.slug if obj.listing_id else None

    def get_reported_user(self, obj):
        return obj.reported_user_id

    def get_review(self, obj):
        return obj.review_id

    def get_is_mine(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        return bool(user and user.is_authenticated and obj.reporter_id == user.id)

    def get_target_name(self, obj):
        """Who or what the report is about, in the queue's own words."""
        if obj.type == ForumReport.Type.ORDER and obj.order_id:
            return obj.order.seller.display_name if obj.reporter_id == obj.order.buyer_id else obj.order.buyer.display_name
        if obj.type == ForumReport.Type.LISTING and obj.listing_id:
            return obj.listing.title
        if obj.type == ForumReport.Type.USER and obj.reported_user_id:
            return short_name(obj.reported_user)
        if obj.type == ForumReport.Type.REVIEW and obj.review_id:
            return f"{obj.review.stars}-star review"
        target = obj.comment.author if obj.comment_id else (obj.post.author if obj.post_id else None)
        return short_name(target) if target else "RTU"

    def get_target_email(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated or not getattr(user, "is_moderator", False):
            return None
        if obj.reported_user_id:
            return obj.reported_user.email
        target = None
        if obj.comment_id:
            target = obj.comment.author
        elif obj.post_id:
            target = obj.post.author
        elif obj.listing_id:
            target = obj.listing.seller
        elif obj.review_id:
            target = obj.review.buyer
        return target.email if target else None

    def get_handled_by_name(self, obj):
        return short_name(obj.handled_by) if obj.handled_by_id else None


class ForumReportResolveSerializer(serializers.Serializer):
    """RM-02: three statuses, and the outcome kept apart from them.

    The four names this endpoint used before (open, reviewed, dismissed,
    actioned) are still accepted and translated, so a client written against the
    old vocabulary keeps working while the record reads the SRS's words.
    """

    STATUS_ALIASES = {
        "open": ForumReport.Status.RECEIVED,
        "reviewed": ForumReport.Status.UNDER_REVIEW,
        "dismissed": ForumReport.Status.RESOLVED,
        "actioned": ForumReport.Status.RESOLVED,
    }

    status = serializers.ChoiceField(
        choices=(
            ForumReport.Status.RECEIVED,
            ForumReport.Status.UNDER_REVIEW,
            ForumReport.Status.RESOLVED,
            "open",
            "reviewed",
            "dismissed",
            "actioned",
        )
    )
    resolution = serializers.ChoiceField(
        choices=(
            ForumReport.Resolution.ACTIONED,
            ForumReport.Resolution.DISMISSED,
            "",
        ),
        required=False,
        allow_blank=True,
    )
    action = serializers.ChoiceField(
        choices=("hide", "restore", "delete", "warn"), required=False, allow_blank=True
    )
    note = serializers.CharField(max_length=300, required=False, allow_blank=True)

    def validate(self, attrs):
        raw = attrs["status"]
        status = self.STATUS_ALIASES.get(raw, raw)
        # A legacy resolution word carries its outcome with it.
        resolution = attrs.get("resolution") or ""
        if raw == "dismissed":
            resolution = ForumReport.Resolution.DISMISSED
        elif raw == "actioned":
            resolution = ForumReport.Resolution.ACTIONED

        if status == ForumReport.Status.RESOLVED and not resolution:
            raise serializers.ValidationError(
                {
                    "resolution": "A resolved report says whether action was taken "
                    "(`actioned`) or not (`dismissed`)."
                }
            )
        if status != ForumReport.Status.RESOLVED:
            resolution = ""

        attrs["status"] = status
        attrs["resolution"] = resolution
        return attrs
