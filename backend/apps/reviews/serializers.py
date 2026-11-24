from rest_framework import serializers

from apps.catalog.models import Listing
from apps.orders.models import Order

from .models import Review


def short_name(user):
    """The name a reviewer is shown by: first name only, like the prototype."""
    name = (user.display_name or user.email or "").strip()
    return name.split(" ")[0] if name else "Member"


class ReviewSerializer(serializers.ModelSerializer):
    """Public read shape.

    The buyer's email is not exposed; `is_mine` is how the client knows it may
    offer Edit/Delete. The order reference is what the UI keys reviews by.
    """

    kind = serializers.CharField(read_only=True)
    order = serializers.CharField(source="order.reference", read_only=True)
    listing_id = serializers.IntegerField(source="listing.id", read_only=True, default=None)
    listing_slug = serializers.CharField(source="listing.slug", read_only=True, default=None)
    listing_title = serializers.CharField(source="listing.title", read_only=True, default=None)
    listing_is_official = serializers.BooleanField(
        source="listing.is_official", read_only=True, default=False
    )
    seller_email = serializers.CharField(source="seller.email", read_only=True)
    seller_name = serializers.CharField(source="seller.display_name", read_only=True)
    buyer_name = serializers.SerializerMethodField()
    is_mine = serializers.SerializerMethodField()
    edited = serializers.BooleanField(source="was_edited", read_only=True)
    # RR-06: the author is told when their edit is waiting on a moderator.
    held = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = (
            "id",
            "kind",
            "order",
            "listing_id",
            "listing_slug",
            "listing_title",
            "listing_is_official",
            "seller_email",
            "seller_name",
            "buyer_name",
            "is_mine",
            "stars",
            "text",
            "edited",
            "held",
            "held_reason",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_buyer_name(self, obj):
        return short_name(obj.buyer)

    def get_held(self, obj):
        return obj.moderation_status == Review.ModerationStatus.NEEDS_REVIEW

    def get_is_mine(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        return bool(user and user.is_authenticated and obj.buyer_id == user.id)


class ReviewWriteSerializer(serializers.Serializer):
    """Create or update one review.

    `listing` omitted/null means the review is about the seller. The order must
    be the caller's own and must already be completed; an item review must name
    a listing that was actually on that order.
    """

    order = serializers.SlugRelatedField(
        slug_field="reference", queryset=Order.objects.select_related("buyer", "seller")
    )
    listing = serializers.PrimaryKeyRelatedField(
        queryset=Listing.objects.all(), required=False, allow_null=True
    )
    stars = serializers.IntegerField(min_value=1, max_value=5)
    text = serializers.CharField(max_length=500, required=False, allow_blank=True)

    def validate(self, attrs):
        request = self.context["request"]
        order = attrs["order"]
        if order.buyer_id != request.user.id:
            raise serializers.ValidationError("You can only rate your own order.")
        if order.status != Order.Status.COMPLETED:
            raise serializers.ValidationError("You can rate an order after the pickup is completed.")

        listing = attrs.get("listing")
        if listing is not None and not order.lines.filter(listing=listing).exists():
            raise serializers.ValidationError("That item is not part of this order.")
        return attrs
