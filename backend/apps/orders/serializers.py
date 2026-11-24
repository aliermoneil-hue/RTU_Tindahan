from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.catalog.models import Listing

from .models import Order, OrderLine
from .services import place_order


def details(exc: DjangoValidationError) -> dict:
    if hasattr(exc, "message_dict"):
        return exc.message_dict
    return {"detail": exc.messages}


class OrderLineSerializer(serializers.ModelSerializer):
    listing_slug = serializers.CharField(source="listing.slug", read_only=True)
    line_total = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )

    class Meta:
        model = OrderLine
        fields = ("id", "listing", "listing_slug", "title", "quantity", "unit_price", "line_total")
        read_only_fields = fields


class OrderSerializer(serializers.ModelSerializer):
    buyer_name = serializers.CharField(source="buyer.display_name", read_only=True)
    buyer_email = serializers.CharField(source="buyer.email", read_only=True)
    seller_name = serializers.CharField(source="seller.display_name", read_only=True)
    seller_email = serializers.CharField(source="seller.email", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    lines = OrderLineSerializer(many=True, read_only=True)
    total_amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )
    is_open = serializers.BooleanField(read_only=True)
    payment_method_display = serializers.CharField(
        source="get_payment_method_display", read_only=True
    )
    buyer_contact = serializers.SerializerMethodField()
    seller_contact = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = (
            "id",
            "reference",
            "buyer",
            "buyer_name",
            "buyer_email",
            "buyer_contact",
            "payment_method",
            "payment_method_display",
            "expires_at",
            "seller",
            "seller_name",
            "seller_email",
            "seller_contact",
            "status",
            "status_display",
            "fulfillment",
            "meetup_place",
            "meetup_date",
            "meetup_time",
            "note",
            "lines",
            "total_amount",
            "is_open",
            "decided_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def _contact_for_other_party(self, obj, party):
        """OT-07: a phone number is shown to the other party only while the order
        is Accepted.

        Before a seller answers there is no meet-up to arrange, so the number
        would be handed out for nothing; after the sale it has no business
        travelling with the record. Only the other party receives it — seeing
        your own number back is noise.
        """
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not (user and user.is_authenticated):
            return None
        if obj.status != Order.Status.ACCEPTED:
            return None
        if party is None or user.id == party.id:
            return None
        if user.id not in (obj.buyer_id, obj.seller_id):
            return None
        return (getattr(party, "contact_number", "") or "").strip() or None

    def get_buyer_contact(self, obj):
        # The buyer's number goes to the seller.
        return self._contact_for_other_party(obj, obj.buyer)

    def get_seller_contact(self, obj):
        # The seller's number goes to the buyer.
        return self._contact_for_other_party(obj, obj.seller)


class OrderCreateLineSerializer(serializers.Serializer):
    listing = serializers.PrimaryKeyRelatedField(queryset=Listing.objects.all())
    quantity = serializers.IntegerField(min_value=1)


class OrderCreateSerializer(serializers.Serializer):
    lines = OrderCreateLineSerializer(many=True)
    fulfillment = serializers.ChoiceField(
        choices=Listing.Fulfillment.choices, required=False, default=Listing.Fulfillment.PICKUP
    )
    meetup_place = serializers.CharField(required=False, allow_blank=True, default="", max_length=200)
    meetup_date = serializers.DateField(required=False, allow_null=True)
    meetup_time = serializers.CharField(required=False, allow_blank=True, default="", max_length=40)
    note = serializers.CharField(required=False, allow_blank=True, default="", max_length=1000)
    payment_method = serializers.ChoiceField(
        choices=Order.Payment.choices, required=False, default=Order.Payment.CASH
    )

    def validate_lines(self, value):
        if not value:
            raise serializers.ValidationError("Add at least one item.")
        return value

    def create(self, validated_data):
        request = self.context["request"]
        try:
            return place_order(
                buyer=request.user,
                lines=validated_data["lines"],
                fulfillment=validated_data.get("fulfillment", Listing.Fulfillment.PICKUP),
                meetup_place=validated_data.get("meetup_place", ""),
                meetup_date=validated_data.get("meetup_date"),
                meetup_time=validated_data.get("meetup_time", ""),
                note=validated_data.get("note", ""),
                payment_method=validated_data.get("payment_method", Order.Payment.CASH),
            )
        except DjangoValidationError as exc:
            raise serializers.ValidationError(details(exc))


class OrderTransitionSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Order.Status.choices)
    note = serializers.CharField(required=False, allow_blank=True, default="", max_length=500)


class OrderPaymentSerializer(serializers.Serializer):
    method = serializers.ChoiceField(choices=Order.Payment.choices)
