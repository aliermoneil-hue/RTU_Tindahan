from rest_framework import serializers

from apps.accounts.models import User
from apps.catalog.models import Listing

from .models import Favorite


class FavoriteSerializer(serializers.ModelSerializer):
    """Read shape: enough to rebuild the frontend's saved ids.

    The UI keys products as `api:<slug>` and sellers by email, so the slug and
    the seller email are what matter; ids and titles are there for admin and for
    a future saved-items screen that does not need a second catalogue call.
    """

    kind = serializers.CharField(read_only=True)
    listing_id = serializers.IntegerField(source="listing.id", read_only=True, default=None)
    listing_slug = serializers.CharField(source="listing.slug", read_only=True, default=None)
    listing_title = serializers.CharField(source="listing.title", read_only=True, default=None)
    seller_id = serializers.IntegerField(source="seller.id", read_only=True, default=None)
    seller_email = serializers.CharField(source="seller.email", read_only=True, default=None)
    seller_name = serializers.CharField(source="seller.display_name", read_only=True, default=None)

    class Meta:
        model = Favorite
        fields = (
            "id",
            "kind",
            "listing_id",
            "listing_slug",
            "listing_title",
            "seller_id",
            "seller_email",
            "seller_name",
            "created_at",
        )
        read_only_fields = fields


class FavoriteToggleSerializer(serializers.Serializer):
    """Write shape for `POST /favorites/toggle/`.

    Exactly one target per call. Saving something the member cannot see or
    cannot buy would leave a dead heart on the page, so the listing must still
    be published and available, and nobody may save their own listing or shop.
    """

    listing = serializers.PrimaryKeyRelatedField(
        queryset=Listing.objects.all(), required=False, allow_null=True
    )
    seller = serializers.SlugRelatedField(
        slug_field="email", queryset=User.objects.all(), required=False, allow_null=True
    )

    def validate(self, attrs):
        listing = attrs.get("listing")
        seller = attrs.get("seller")
        if (listing is None) == (seller is None):
            raise serializers.ValidationError("Send exactly one of `listing` or `seller`.")

        user = self.context["request"].user
        if listing is not None:
            if listing.seller_id == user.id:
                raise serializers.ValidationError("You cannot save your own listing.")
            if not (
                listing.moderation_status == Listing.ModerationStatus.APPROVED
                and listing.availability_status == Listing.AvailabilityStatus.AVAILABLE
            ):
                raise serializers.ValidationError("That listing is not available to save.")
        else:
            if seller.id == user.id:
                raise serializers.ValidationError("You cannot save your own shop.")
            if not seller.can_sign_in:
                raise serializers.ValidationError("That seller is no longer available.")
        return attrs
