from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from apps.accounts.models import User
from apps.catalog.models import Listing

from .models import Conversation, Message


def details(exc: DjangoValidationError) -> dict:
    if hasattr(exc, "message_dict"):
        return exc.message_dict
    return {"detail": exc.messages}


class MessageSerializer(serializers.ModelSerializer):
    sender_email = serializers.CharField(source="sender.email", read_only=True, default=None)
    sender_name = serializers.CharField(
        source="sender.display_name", read_only=True, default=None
    )

    class Meta:
        model = Message
        fields = ("id", "sender", "sender_email", "sender_name", "body", "created_at", "read_at")
        read_only_fields = fields


class ConversationSerializer(serializers.ModelSerializer):
    buyer_name = serializers.CharField(source="buyer.display_name", read_only=True)
    buyer_email = serializers.CharField(source="buyer.email", read_only=True)
    seller_name = serializers.CharField(source="seller.display_name", read_only=True)
    seller_email = serializers.CharField(source="seller.email", read_only=True)
    listing_title = serializers.CharField(source="listing.title", read_only=True, default=None)
    listing_slug = serializers.CharField(source="listing.slug", read_only=True, default=None)
    messages = MessageSerializer(many=True, read_only=True)
    unread = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = (
            "id",
            "buyer",
            "buyer_name",
            "buyer_email",
            "seller",
            "seller_name",
            "seller_email",
            "listing",
            "listing_title",
            "listing_slug",
            "messages",
            "unread",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_unread(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return 0
        return obj.unread_for(request.user)


class ConversationOpenSerializer(serializers.Serializer):
    """The caller names the other party; the buyer/seller roles come from that."""

    seller_email = serializers.EmailField(required=False, allow_blank=True, default="")
    buyer_email = serializers.EmailField(required=False, allow_blank=True, default="")
    listing = serializers.SlugRelatedField(
        slug_field="slug",
        queryset=Listing.objects.all(),
        required=False,
        allow_null=True,
    )

    def validate(self, attrs):
        request = self.context["request"]
        me = request.user
        seller_email = (attrs.get("seller_email") or "").strip().lower()
        buyer_email = (attrs.get("buyer_email") or "").strip().lower()

        if bool(seller_email) == bool(buyer_email):
            raise serializers.ValidationError(
                {"detail": "Name exactly one other person: seller_email or buyer_email."}
            )

        if seller_email:
            seller = User.objects.filter(email__iexact=seller_email).first()
            if seller is None:
                raise serializers.ValidationError({"seller_email": "No member uses that email."})
            buyer = me
        else:
            buyer = User.objects.filter(email__iexact=buyer_email).first()
            if buyer is None:
                raise serializers.ValidationError({"buyer_email": "No member uses that email."})
            seller = me

        if buyer.pk == seller.pk:
            raise serializers.ValidationError({"detail": "You cannot message yourself."})

        attrs["buyer"] = buyer
        attrs["seller"] = seller
        return attrs

    def create(self, validated_data):
        listing = validated_data.get("listing")
        with transaction.atomic():
            conversation, created = Conversation.objects.get_or_create(
                buyer=validated_data["buyer"],
                seller=validated_data["seller"],
                defaults={"listing": listing},
            )
            # A later thread about a different item keeps the newer context, so
            # the header on both sides names something the buyer is asking about.
            if not created and listing is not None and conversation.listing_id != listing.pk:
                conversation.listing = listing
                conversation.save(update_fields=["listing", "updated_at"])
        return conversation


class MessageCreateSerializer(serializers.Serializer):
    body = serializers.CharField(max_length=2000, trim_whitespace=True)

    def validate_body(self, value):
        if not value.strip():
            raise serializers.ValidationError("Write a message first.")
        return value


class MarkReadSerializer(serializers.Serializer):
    pass


def touch(conversation):
    conversation.updated_at = timezone.now()
    conversation.save(update_fields=["updated_at"])
    return conversation
