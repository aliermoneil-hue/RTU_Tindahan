from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator, MinValueValidator
from django.db import models
from django.utils import timezone
from django.utils.text import slugify


def validate_image_size(image):
    """SE-06: photos are limited to 5 MB."""
    if image.size > 5 * 1024 * 1024:
        raise ValidationError("The photo must be 5 MB or smaller.")


class Category(models.Model):
    name = models.CharField(max_length=80, unique=True)
    slug = models.SlugField(max_length=90, unique=True, blank=True)
    parent = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="children",
        help_text="Optional. Used for sub-types such as Uniform or Textbook.",
    )
    sort_order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "name"]
        verbose_name_plural = "categories"
        indexes = [models.Index(fields=["is_active", "sort_order"])]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


class Listing(models.Model):
    class Type(models.TextChoices):
        PRODUCT = "product", "Product"
        SERVICE = "service", "Service"

    class Condition(models.TextChoices):
        NEW = "new", "New"
        USED = "used", "Used"
        NOT_APPLICABLE = "na", "Not applicable"

    class ModerationStatus(models.TextChoices):
        DRAFT = "draft", "Draft"
        PENDING_SCREENING = "pending_screening", "Pending screening"
        APPROVED = "approved", "Approved"
        NEEDS_REVIEW = "needs_review", "Needs review"
        REJECTED = "rejected", "Rejected"

    class Fulfillment(models.TextChoices):
        PICKUP = "pickup", "Campus pickup"
        DELIVERY = "delivery", "Campus delivery"
        BOTH = "both", "Pickup or delivery"

    class AvailabilityStatus(models.TextChoices):
        AVAILABLE = "available", "Available"
        SOLD = "sold", "Sold"
        UNAVAILABLE = "unavailable", "Unavailable"
        REMOVED = "removed", "Removed"

    # LS-01: seller and item details
    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="listings",
    )
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="listings",
    )
    title = models.CharField(max_length=150)
    slug = models.SlugField(max_length=170, unique=True, blank=True)
    description = models.TextField()
    listing_type = models.CharField(
        max_length=20, choices=Type.choices, default=Type.PRODUCT
    )
    condition = models.CharField(
        max_length=20, choices=Condition.choices, default=Condition.NEW
    )
    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    quantity = models.PositiveIntegerField(
        default=1, validators=[MinValueValidator(1)]
    )
    meetup_place = models.CharField(max_length=200)
    # What the seller offers for this item. The cart needs it before it can
    # finish a request: a listing with no method reads "Not configured" and
    # blocks checkout.
    fulfillment = models.CharField(
        max_length=10,
        choices=Fulfillment.choices,
        default=Fulfillment.PICKUP,
    )

    # ST-01/ST-02: the Official Store reuses this model.
    is_official = models.BooleanField(default=False, db_index=True)

    # LS-05, AI-02: new listings wait for screening before publication.
    # Moderation and availability are independent facts: a listing can be
    # approved and sold, or approved and temporarily unavailable. They were once
    # one column, which made "approved but out of stock" inexpressible.
    moderation_status = models.CharField(
        max_length=30,
        choices=ModerationStatus.choices,
        default=ModerationStatus.PENDING_SCREENING,
        db_index=True,
    )
    availability_status = models.CharField(
        max_length=20,
        choices=AvailabilityStatus.choices,
        default=AvailabilityStatus.AVAILABLE,
        db_index=True,
    )
    rejection_reason = models.TextField(blank=True)

    # BD-03/BD-07: popularity and freshness inputs for ranking.
    view_count = models.PositiveIntegerField(default=0)
    sold_count = models.PositiveIntegerField(default=0)

    published_at = models.DateTimeField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["moderation_status", "published_at"]),
            models.Index(fields=["category", "moderation_status"]),
            models.Index(fields=["seller", "moderation_status"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(price__gt=0),
                name="catalog_listing_price_positive",
            ),
            models.CheckConstraint(
                condition=models.Q(quantity__gte=1),
                name="catalog_listing_quantity_at_least_1",
            ),
            # A rejected listing cannot be on sale; the two fields must agree
            # on that one combination.
            models.CheckConstraint(
                condition=~(
                    models.Q(moderation_status="rejected")
                    & models.Q(availability_status="sold")
                ),
                name="catalog_rejected_listing_not_sold",
            ),
        ]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = self._unique_slug()
        super().save(*args, **kwargs)

    def _unique_slug(self):
        base = slugify(self.title)[:150] or "listing"
        slug = base
        counter = 2
        qs = Listing.objects.all()
        if self.pk:
            qs = qs.exclude(pk=self.pk)
        while qs.filter(slug=slug).exists():
            slug = f"{base}-{counter}"
            counter += 1
        return slug

    def clean(self):
        super().clean()

        if (
            self.listing_type == self.Type.SERVICE
            and self.condition != self.Condition.NOT_APPLICABLE
        ):
            raise ValidationError(
                {"condition": "Services use the 'Not applicable' condition."}
            )
        if (
            self.listing_type == self.Type.PRODUCT
            and self.condition == self.Condition.NOT_APPLICABLE
        ):
            raise ValidationError({"condition": "Choose New or Used for a product."})

        # BR-04: only Office Staff may publish official items.
        if self.is_official and self.seller_id and not self.seller.is_office_staff:
            raise ValidationError(
                {"is_official": "Only Office Staff may publish official items."}
            )

    # -- State transitions -------------------------------------------------

    def approve(self):
        self.moderation_status = self.ModerationStatus.APPROVED
        if self.published_at is None:
            self.published_at = timezone.now()
        self.save(update_fields=["moderation_status", "published_at", "updated_at"])

    def reject(self, reason=""):
        self.moderation_status = self.ModerationStatus.REJECTED
        self.availability_status = self.AvailabilityStatus.UNAVAILABLE
        self.rejection_reason = reason
        self.save(
            update_fields=[
                "moderation_status",
                "availability_status",
                "rejection_reason",
                "updated_at",
            ]
        )

    def send_to_review(self):
        self.moderation_status = self.ModerationStatus.NEEDS_REVIEW
        self.save(update_fields=["moderation_status", "updated_at"])

    def mark_sold(self):
        self.availability_status = self.AvailabilityStatus.SOLD
        self.save(update_fields=["availability_status", "updated_at"])

    def mark_unavailable(self):
        self.availability_status = self.AvailabilityStatus.UNAVAILABLE
        self.save(update_fields=["availability_status", "updated_at"])

    def mark_removed(self):
        self.availability_status = self.AvailabilityStatus.REMOVED
        self.save(update_fields=["availability_status", "updated_at"])

    @property
    def status(self) -> str:
        """The combined value this row had before the split.

        Read-only and derived: kept so responses and older clients that read a
        single `status` string keep working now that the column is two fields.
        """
        availability = self.availability_status
        moderation = self.moderation_status
        if availability == self.AvailabilityStatus.SOLD:
            return "sold"
        if moderation == self.ModerationStatus.REJECTED:
            return "rejected"
        if availability == self.AvailabilityStatus.REMOVED:
            return "removed"
        if availability == self.AvailabilityStatus.UNAVAILABLE:
            return "unavailable"
        return str(moderation)

    @property
    def is_published(self):
        return (
            self.moderation_status == self.ModerationStatus.APPROVED
            and self.availability_status == self.AvailabilityStatus.AVAILABLE
        )


class ListingPhoto(models.Model):
    listing = models.ForeignKey(
        Listing, on_delete=models.CASCADE, related_name="photos"
    )
    image = models.ImageField(
        upload_to="listings/%Y/%m/",
        validators=[
            FileExtensionValidator(["jpg", "jpeg", "png", "webp"]),
            validate_image_size,
        ],
    )
    alt_text = models.CharField(max_length=120, blank=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sort_order", "id"]

    def __str__(self):
        return f"Photo for {self.listing.title}"


class ListingVariant(models.Model):
    """A size or type of a listing. Stock lives here, not on the listing."""

    listing = models.ForeignKey(
        Listing, on_delete=models.CASCADE, related_name="variants"
    )
    name = models.CharField(max_length=80, help_text="e.g. Small, Medium, A4.")
    sku = models.CharField(max_length=64, blank=True)
    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Leave blank to use the listing price.",
    )

    # Stock state. Changes only through the stock ledger in apps.store.
    on_hand = models.PositiveIntegerField(default=0)
    available = models.PositiveIntegerField(default=0)
    low_stock_threshold = models.PositiveIntegerField(null=True, blank=True)

    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "name"]
        indexes = [models.Index(fields=["listing", "is_active"])]
        constraints = [
            models.UniqueConstraint(
                fields=["listing", "name"],
                name="catalog_unique_variant_name_per_listing",
            ),
            models.CheckConstraint(
                condition=models.Q(available__lte=models.F("on_hand")),
                name="catalog_variant_available_lte_on_hand",
            ),
        ]

    def __str__(self):
        return f"{self.listing.title} — {self.name}"

    @property
    def reserved(self):
        return self.on_hand - self.available

    @property
    def unit_price(self):
        return self.price if self.price is not None else self.listing.price

    @property
    def is_low_stock(self):
        threshold = self.low_stock_threshold
        if threshold is None:
            from apps.store.models import StoreSetting

            threshold = StoreSetting.get_solo().low_stock_threshold
        return self.available <= threshold
