"""Serializers for the catalogue: categories, listings, photos, variants.

Two rules hold everywhere in this file:

1. The browser never sets `is_official`, `status`, or any stock number. Those
   belong to Office Staff, the screening step, and the stock ledger.
2. Model validation lives in `Listing.clean()`, which Django REST Framework
   does not call, so the same rules are repeated in `ListingWriteSerializer`.
"""

from pathlib import Path

from django.conf import settings
from rest_framework import serializers

from .models import Category, Listing, ListingPhoto, ListingVariant

PHOTO_TYPES = {"jpg", "jpeg", "png", "webp"}


class PhotoListField(serializers.ListField):
    """Uploaded photos, checked against the same rules as the model (SE-06)."""

    child = serializers.ImageField()

    def to_internal_value(self, data):
        images = super().to_internal_value(data)
        for image in images:
            if image.size > settings.MAX_UPLOAD_SIZE:
                raise serializers.ValidationError("Each photo must be 5 MB or smaller.")
            suffix = Path(image.name).suffix.lower().lstrip(".")
            if suffix not in PHOTO_TYPES:
                raise serializers.ValidationError(
                    "Photos must be JPG, PNG, or WebP."
                )
        return images


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ("id", "name", "slug", "parent", "sort_order", "is_active")
        read_only_fields = ("slug",)


class ListingPhotoSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = ListingPhoto
        fields = ("id", "url", "alt_text", "sort_order")

    def get_url(self, obj: ListingPhoto) -> str:
        # Relative on purpose: the browser then fetches photos from the same
        # origin it loaded the page from, so the host's /media proxy serves and
        # caches them (a week) instead of every photo opening a second
        # connection to the backend and skipping the cache.
        return obj.image.url


class ListingVariantSerializer(serializers.ModelSerializer):
    reserved = serializers.IntegerField(read_only=True)
    unit_price = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True
    )

    class Meta:
        model = ListingVariant
        fields = (
            "id",
            "name",
            "sku",
            "price",
            "unit_price",
            "on_hand",
            "available",
            "reserved",
            "low_stock_threshold",
            "is_active",
        )
        # Stock moves only through apps.store.services and its ledger.
        read_only_fields = ("on_hand", "available")


class ListingReadSerializer(serializers.ModelSerializer):
    seller_name = serializers.CharField(source="seller.display_name", read_only=True)
    seller_email = serializers.CharField(source="seller.email", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    category_slug = serializers.CharField(source="category.slug", read_only=True)
    photos = ListingPhotoSerializer(many=True, read_only=True)
    variants = ListingVariantSerializer(many=True, read_only=True)
    is_published = serializers.BooleanField(read_only=True)
    # The pre-split single value, now derived. Declared explicitly so DRF reads
    # the model property instead of looking for a database column.
    status = serializers.CharField(read_only=True)
    # AI-03: the moderator queue needs to know why a listing was flagged.
    # Everyone else gets null, so a seller never sees the scoring rules.
    screening = serializers.SerializerMethodField()
    # Annotated by the view; methods keep create/retrieve from erroring when the
    # instance did not come through that queryset.
    rating_avg = serializers.SerializerMethodField()
    rating_count = serializers.SerializerMethodField()

    class Meta:
        model = Listing
        fields = (
            "id",
            "slug",
            "title",
            "description",
            "category",
            "category_name",
            "category_slug",
            "listing_type",
            "condition",
            "price",
            "quantity",
            "meetup_place",
            "is_official",
            "moderation_status",
            "availability_status",
            "fulfillment",
            "status",
            "rejection_reason",
            "view_count",
            "sold_count",
            "published_at",
            "created_at",
            "seller_name",
            "seller_email",
            "photos",
            "variants",
            "is_published",
            "screening",
            "rating_avg",
            "rating_count",
        )
        read_only_fields = fields

    def get_screening(self, obj: Listing):
        """Latest screening verdict, for staff only (AI-03)."""
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not (user and user.is_authenticated and user.is_moderator):
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
            "at": latest.created_at,
        }

    def get_rating_avg(self, obj: Listing):
        value = getattr(obj, "rating_avg", None)
        return round(float(value), 2) if value is not None else None

    def get_rating_count(self, obj: Listing):
        return int(getattr(obj, "rating_count", 0) or 0)


class ListingWriteSerializer(serializers.ModelSerializer):
    """What a verified member may send when posting or editing an item (LS-01)."""

    upload_photos = PhotoListField(
        write_only=True, required=False, max_length=10, default=list
    )

    class Meta:
        model = Listing
        fields = (
            "category",
            "title",
            "description",
            "listing_type",
            "condition",
            "price",
            "quantity",
            "meetup_place",
            "fulfillment",
            "upload_photos",
        )

    def validate(self, attrs):
        current = self.instance
        listing_type = attrs.get("listing_type", getattr(current, "listing_type", None))
        condition = attrs.get("condition", getattr(current, "condition", None))

        # Mirrors Listing.clean(); DRF never calls full_clean().
        if (
            listing_type == Listing.Type.SERVICE
            and condition != Listing.Condition.NOT_APPLICABLE
        ):
            raise serializers.ValidationError(
                {"condition": "Services use the 'Not applicable' condition."}
            )
        if (
            listing_type == Listing.Type.PRODUCT
            and condition == Listing.Condition.NOT_APPLICABLE
        ):
            raise serializers.ValidationError(
                {"condition": "Choose New or Used for a product."}
            )
        return attrs

    def create(self, validated_data):
        photos = validated_data.pop("upload_photos", [])
        listing = Listing.objects.create(
            seller=self.context["request"].user,
            moderation_status=Listing.ModerationStatus.PENDING_SCREENING,  # LS-05 / AI-02
            availability_status=Listing.AvailabilityStatus.AVAILABLE,
            **validated_data,
        )
        for index, image in enumerate(photos):
            ListingPhoto.objects.create(listing=listing, image=image, sort_order=index)
        return listing

    def update(self, instance, validated_data):
        photos = validated_data.pop("upload_photos", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()

        if photos:
            offset = instance.photos.count()
            for index, image in enumerate(photos):
                ListingPhoto.objects.create(
                    listing=instance, image=image, sort_order=offset + index
                )
        return instance
