"""Serializers for the Official Store.

Everything here delegates the actual stock work to `apps/store/services.py`.
The serializers only translate JSON into model objects and turn Django's
`ValidationError` (which the services raise) into DRF's 400 responses.
"""

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.accounts.models import User
from apps.catalog.models import Listing, ListingVariant

from .models import (
    DailyCount,
    OfficialTicket,
    StockMovement,
    StoreSetting,
    TicketItem,
    TicketStatusHistory,
)
from .services import place_official_order


def details(exc: DjangoValidationError) -> dict:
    """Turn a Django ValidationError into something DRF can return as 400."""
    if hasattr(exc, "message_dict"):
        return exc.message_dict
    return {"detail": exc.messages}


# ---------------------------------------------------------------------------
# Read serializers
# ---------------------------------------------------------------------------


class TicketItemSerializer(serializers.ModelSerializer):
    listing_title = serializers.CharField(source="listing.title", read_only=True)
    variant_name = serializers.CharField(
        source="variant.name", read_only=True, default=None
    )
    line_total = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )

    class Meta:
        model = TicketItem
        fields = (
            "id",
            "listing",
            "listing_title",
            "variant",
            "variant_name",
            "quantity",
            "unit_price",
            "line_total",
        )
        read_only_fields = fields


class TicketStatusHistorySerializer(serializers.ModelSerializer):
    changed_by_email = serializers.CharField(
        source="changed_by.email", read_only=True, default=None
    )

    class Meta:
        model = TicketStatusHistory
        fields = (
            "id",
            "from_status",
            "to_status",
            "changed_by_email",
            "note",
            "created_at",
        )
        read_only_fields = fields


class OfficialTicketSerializer(serializers.ModelSerializer):
    buyer_name = serializers.CharField(source="buyer.display_name", read_only=True)
    buyer_email = serializers.CharField(source="buyer.email", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    items = TicketItemSerializer(many=True, read_only=True)
    status_history = TicketStatusHistorySerializer(many=True, read_only=True)
    total_amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )
    is_open = serializers.BooleanField(read_only=True)

    class Meta:
        model = OfficialTicket
        fields = (
            "id",
            "reference",
            "buyer",
            "buyer_name",
            "buyer_email",
            "status",
            "status_display",
            "pickup_date",
            "claim_notes",
            "cancelled_reason",
            "items",
            "total_amount",
            "is_open",
            "status_history",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class StockMovementSerializer(serializers.ModelSerializer):
    item = serializers.CharField(source="variant.listing.title", read_only=True)
    variant_name = serializers.CharField(source="variant.name", read_only=True)
    ticket_reference = serializers.CharField(
        source="ticket.reference", read_only=True, default=None
    )
    created_by_email = serializers.CharField(
        source="created_by.email", read_only=True, default=None
    )

    class Meta:
        model = StockMovement
        fields = (
            "id",
            "variant",
            "item",
            "variant_name",
            "ticket_reference",
            "kind",
            "quantity",
            "reason",
            "on_hand_after",
            "available_after",
            "created_by_email",
            "created_at",
        )
        read_only_fields = fields


class DailyCountSerializer(serializers.ModelSerializer):
    item = serializers.CharField(source="variant.listing.title", read_only=True)
    variant_name = serializers.CharField(source="variant.name", read_only=True)
    counted_by_email = serializers.CharField(
        source="counted_by.email", read_only=True, default=None
    )

    class Meta:
        model = DailyCount
        fields = (
            "id",
            "variant",
            "item",
            "variant_name",
            "counted_on",
            "expected_on_hand",
            "counted_quantity",
            "difference",
            "reason",
            "counted_by_email",
            "created_at",
        )
        read_only_fields = fields


class StoreSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = StoreSetting
        fields = (
            "low_stock_threshold",
            "max_quantity_per_ticket",
            "max_quantity_per_student",
            "ordering_window_enabled",
            "ordering_window_start",
            "ordering_window_end",
            "allow_cancel_from",
            "updated_at",
        )
        read_only_fields = ("updated_at",)


# ---------------------------------------------------------------------------
# Write serializers
# ---------------------------------------------------------------------------


class TicketLineSerializer(serializers.Serializer):
    listing = serializers.PrimaryKeyRelatedField(queryset=Listing.objects.all())
    variant = serializers.PrimaryKeyRelatedField(
        queryset=ListingVariant.objects.all()
    )
    quantity = serializers.IntegerField(min_value=1)


class OfficialTicketCreateSerializer(serializers.Serializer):
    """A student's request. Stock, limits, and windows are checked in services.

    Office Staff may name another buyer (``buyer_email``) to record a walk-in
    face-to-face request: the student is standing at the window and may not be
    signed in on the office machine. Everyone else always orders for themselves,
    whatever the payload says.
    """

    items = TicketLineSerializer(many=True)
    pickup_date = serializers.DateField(required=False, allow_null=True)
    claim_notes = serializers.CharField(
        required=False, allow_blank=True, default="", max_length=1000
    )
    buyer_email = serializers.EmailField(required=False, allow_blank=True, default="")

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("Add at least one item.")
        return value

    def validate(self, attrs):
        request = self.context["request"]
        wanted = (attrs.get("buyer_email") or "").strip().lower()
        if not wanted:
            attrs["buyer"] = request.user
            return attrs

        if not getattr(request.user, "is_office_staff", False):
            raise serializers.ValidationError(
                {"buyer_email": "Only office staff can order for another student."}
            )
        buyer = User.objects.filter(email__iexact=wanted).first()
        if buyer is None:
            raise serializers.ValidationError(
                {"buyer_email": "No RTU Tindahan member uses that email."}
            )
        attrs["buyer"] = buyer
        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        try:
            return place_official_order(
                buyer=validated_data["buyer"],
                items=validated_data["items"],
                pickup_date=validated_data.get("pickup_date"),
                claim_notes=validated_data.get("claim_notes", ""),
                created_by=request.user,
            )
        except DjangoValidationError as exc:
            raise serializers.ValidationError(details(exc))


class TicketTransitionSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=OfficialTicket.Status.choices)
    note = serializers.CharField(required=False, allow_blank=True, default="")


class StockInSerializer(serializers.Serializer):
    variant = serializers.PrimaryKeyRelatedField(
        queryset=ListingVariant.objects.all()
    )
    quantity = serializers.IntegerField(min_value=1)
    reason = serializers.CharField(
        required=False, allow_blank=True, default="New stock received", max_length=500
    )


class DailyCountCreateSerializer(serializers.Serializer):
    variant = serializers.PrimaryKeyRelatedField(
        queryset=ListingVariant.objects.all()
    )
    counted_quantity = serializers.IntegerField(min_value=0)
    reason = serializers.CharField(
        required=False, allow_blank=True, default="", max_length=500
    )
    counted_on = serializers.DateField(required=False)
