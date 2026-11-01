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

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PENDING_SCREENING = "pending_screening", "Pending screening"
        APPROVED = "approved", "Approved"
        NEEDS_REVIEW = "needs_review", "Needs review"
        REJECTED = "rejected", "Rejected"
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

    # ST-01/ST-02: the Official Store reuses this model.
    is_official = models.BooleanField(default=False, db_index=True)

    # LS-05, AI-02: new listings wait for screening before publication.
    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.PENDING_SCREENING,
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
            models.Index(fields=["status", "published_at"]),
            models.Index(fields=["category", "status"]),
            models.Index(fields=["seller", "status"]),
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

    def approve(self):
        self.status = self.Status.APPROVED
        if self.published_at is None:
            self.published_at = timezone.now()
        self.save(update_fields=["status", "published_at", "updated_at"])

    def reject(self, reason=""):
        self.status = self.Status.REJECTED
        self.rejection_reason = reason
        self.save(update_fields=["status", "rejection_reason", "updated_at"])

    def mark_sold(self):
        self.status = self.Status.SOLD
        self.save(update_fields=["status", "updated_at"])

    @property
    def is_published(self):
        return self.status == self.Status.APPROVED


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
