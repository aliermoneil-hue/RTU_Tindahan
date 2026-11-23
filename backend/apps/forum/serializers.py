import base64
import binascii
import re
import uuid

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from rest_framework import serializers

from apps.accounts.models import User
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
        name = f"forum/{uuid.uuid4().hex}.{IMAGE_TYPES[kind]}"
        saved.append(default_storage.save(name, ContentFile(payload)))
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


class ForumPostSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    author_role = serializers.SerializerMethodField()
    is_mine = serializers.SerializerMethodField()
    images = serializers.SerializerMethodField()
    hidden = serializers.SerializerMethodField()
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
            "author_name",
            "author_role",
            "is_mine",
            "images",
            "pinned",
            "hidden",
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

    def get_comments(self, obj):
        return ForumCommentSerializer(
            obj.comments.select_related("author", "hidden_by"), many=True, context=self.context
        ).data

    def get_comment_count(self, obj):
        return sum(1 for c in obj.comments.all() if not c.is_deleted and not c.is_hidden)

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


class ForumPostWriteSerializer(serializers.ModelSerializer):
    images = serializers.ListField(
        child=serializers.CharField(allow_blank=False), required=False, write_only=True
    )

    class Meta:
        model = ForumPost
        fields = ("kind", "topic", "title", "body", "images")

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
            reporter=user, post=post, comment=comment, status=ForumReport.Status.OPEN
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
    target_name = serializers.SerializerMethodField()
    handled_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ForumReport
        fields = (
            "id",
            "type",
            "post",
            "comment",
            "order",
            "reporter_name",
            "is_mine",
            "reason",
            "details",
            "snapshot_title",
            "snapshot_text",
            "status",
            "target_name",
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

    def get_is_mine(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        return bool(user and user.is_authenticated and obj.reporter_id == user.id)

    def get_target_name(self, obj):
        if obj.type == ForumReport.Type.ORDER and obj.order_id:
            return obj.order.seller.display_name if obj.reporter_id == obj.order.buyer_id else obj.order.buyer.display_name
        target = obj.comment.author if obj.comment_id else (obj.post.author if obj.post_id else None)
        return short_name(target) if target else "RTU"

    def get_handled_by_name(self, obj):
        return short_name(obj.handled_by) if obj.handled_by_id else None


class ForumReportResolveSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=(
            ForumReport.Status.OPEN,
            ForumReport.Status.REVIEWED,
            ForumReport.Status.DISMISSED,
            ForumReport.Status.ACTIONED,
        )
    )
    action = serializers.ChoiceField(
        choices=("hide", "restore", "delete", "warn"), required=False, allow_blank=True
    )
    note = serializers.CharField(max_length=300, required=False, allow_blank=True)
