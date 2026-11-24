from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone


class OfficialTicket(models.Model):
    """One Official Store request. Status names follow prototype v1.6."""

    class Status(models.TextChoices):
        REQUEST_RECEIVED = "request_received", "Request Received"
        CONFIRMED = "confirmed", "Confirmed"
        ON_HOLD = "on_hold", "On Hold"
        READY_FOR_PICKUP = "ready_for_pickup", "Ready for Pickup"
        CLAIMED = "claimed", "Claimed"
        CANCELLED = "cancelled", "Cancelled"

    reference = models.CharField(max_length=20, unique=True, blank=True)
    buyer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="official_tickets",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.REQUEST_RECEIVED,
        db_index=True,
    )
    pickup_date = models.DateField(null=True, blank=True)
    # OS-12: assigned when the office confirms, from the settings' prefix and
    # width; blank until then, which is what "the queue number if any" means.
    queue_number = models.CharField(max_length=16, blank=True)
    claim_notes = models.TextField(blank=True)
    cancelled_reason = models.TextField(blank=True)
    processed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="processed_official_tickets",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "created_at"])]

    def __str__(self):
        return self.reference

    def save(self, *args, **kwargs):
        if not self.reference:
            self.reference = self._generate_reference()
        super().save(*args, **kwargs)

    def _generate_reference(self):
        today = timezone.localdate()
        prefix = f"TXN-{today:%y%m%d}-"
        last = (
            type(self)
            .objects.filter(reference__startswith=prefix)
            .order_by("-reference")
            .first()
        )
        number = 1
        if last:
            try:
                number = int(last.reference.rsplit("-", 1)[1]) + 1
            except (IndexError, ValueError):
                pass
        return f"{prefix}{number:03d}"

    @property
    def total_amount(self):
        return sum((item.line_total for item in self.items.all()), Decimal("0.00"))

    @property
    def is_open(self):
        return self.status not in {self.Status.CLAIMED, self.Status.CANCELLED}


class StoreSetting(models.Model):
    """Editable store policy. One row. The BAO confirms these values."""

    low_stock_threshold = models.PositiveIntegerField(default=5)
    max_quantity_per_ticket = models.PositiveIntegerField(default=10)
    max_quantity_per_student = models.PositiveIntegerField(
        default=0, help_text="0 means no limit across open tickets."
    )
    ordering_window_enabled = models.BooleanField(default=False)
    ordering_window_start = models.TimeField(null=True, blank=True)
    ordering_window_end = models.TimeField(null=True, blank=True)
    # EM-04: where a low stock message goes. Empty means the message is Skipped.
    # OS-12: the store's own rules, editable by staff rather than a deploy.
    # Empty means "use the code's defaults" so an untouched store behaves as before.
    allowed_transitions = models.JSONField(
        default=dict,
        blank=True,
        help_text="status -> list of statuses it may move to; empty uses the built-in graph.",
    )
    reason_required = models.JSONField(
        default=list,
        blank=True,
        help_text="statuses that cannot be set without a note.",
    )
    queue_prefix = models.CharField(
        max_length=6, default="Q", help_text="Printed before the daily queue number."
    )
    queue_number_width = models.PositiveSmallIntegerField(
        default=3, help_text="How many digits the queue number is padded to."
    )
    claim_note = models.TextField(
        blank=True,
        help_text="Store-wide note shown with every ticket and in its message.",
    )
    low_stock_emails = models.JSONField(
        default=list,
        blank=True,
        help_text="RTU staff addresses for low stock mail, e.g. [\"bao@rtu.edu.ph\"].",
    )
    allow_cancel_from = models.JSONField(
        default=list,
        blank=True,
        help_text='Status codes, e.g. ["request_received"].',
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "store setting"
        verbose_name_plural = "store settings"

    def __str__(self):
        return "Official Store settings"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    @property
    def cancel_from(self):
        return self.allow_cancel_from or [OfficialTicket.Status.REQUEST_RECEIVED]


class TicketItem(models.Model):
    ticket = models.ForeignKey(
        OfficialTicket, on_delete=models.CASCADE, related_name="items"
    )
    listing = models.ForeignKey(
        "catalog.Listing", on_delete=models.PROTECT, related_name="ticket_items"
    )
    variant = models.ForeignKey(
        "catalog.ListingVariant",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="ticket_items",
    )
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.quantity} x {self.listing.title}"

    @property
    def line_total(self):
        return self.quantity * self.unit_price

    def clean(self):
        super().clean()
        if self.listing_id and not self.listing.is_official:
            raise ValidationError({"listing": "Only official items can be ticketed."})
        if self.variant_id and self.variant.listing_id != self.listing_id:
            raise ValidationError(
                {"variant": "The variant does not belong to this listing."}
            )


class TicketStatusHistory(models.Model):
    ticket = models.ForeignKey(
        OfficialTicket, on_delete=models.CASCADE, related_name="status_history"
    )
    from_status = models.CharField(
        max_length=20, choices=OfficialTicket.Status.choices, blank=True
    )
    to_status = models.CharField(max_length=20, choices=OfficialTicket.Status.choices)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return f"{self.from_status} → {self.to_status}"


class DailyCount(models.Model):
    """A physical count compared with On Hand. Differences become adjustments."""

    variant = models.ForeignKey(
        "catalog.ListingVariant",
        on_delete=models.PROTECT,
        related_name="daily_counts",
    )
    counted_on = models.DateField(default=timezone.localdate)
    expected_on_hand = models.PositiveIntegerField()
    counted_quantity = models.PositiveIntegerField()
    difference = models.IntegerField()
    reason = models.TextField(blank=True)
    counted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-counted_on", "-id"]

    def __str__(self):
        return f"{self.variant} on {self.counted_on}"

    def save(self, *args, **kwargs):
        self.difference = self.counted_quantity - self.expected_on_hand
        super().save(*args, **kwargs)

    def clean(self):
        super().clean()
        if self.difference != 0 and not self.reason.strip():
            raise ValidationError(
                {"reason": "A reason is required when the count differs."}
            )


class StockMovement(models.Model):
    """Append-only ledger. Never edit or delete a row."""

    class Kind(models.TextChoices):
        STOCK_IN = "stock_in", "Stock In"
        RESERVED = "reserved", "Reserved"
        RELEASED = "released", "Released"
        ISSUED = "issued", "Issued"
        SOLD = "sold", "Sold"
        ADJUSTMENT = "adjustment", "Adjustment"

    variant = models.ForeignKey(
        "catalog.ListingVariant",
        on_delete=models.PROTECT,
        related_name="stock_movements",
    )
    ticket = models.ForeignKey(
        OfficialTicket,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="stock_movements",
    )
    daily_count = models.ForeignKey(
        DailyCount,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="adjustments",
    )
    kind = models.CharField(max_length=20, choices=Kind.choices)
    quantity = models.IntegerField(
        help_text="Positive except adjustments, which may be negative."
    )
    reason = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    on_hand_after = models.PositiveIntegerField()
    available_after = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]
        constraints = [
            models.CheckConstraint(
                condition=~models.Q(quantity=0),
                name="store_stock_movement_quantity_nonzero",
            ),
            models.CheckConstraint(
                condition=models.Q(kind="adjustment") | models.Q(quantity__gt=0),
                name="store_stock_movement_positive_except_adjustment",
            ),
        ]

    def __str__(self):
        return f"{self.get_kind_display()} {self.quantity} — {self.variant}"


class EmailOutbox(models.Model):
    """Prepared messages only. This project never sends email from here."""

    class Kind(models.TextChoices):
        STUDENT = "student", "Student"
        STAFF = "staff", "Staff"

    class State(models.TextChoices):
        PREPARED = "prepared", "Prepared"
        SKIPPED = "skipped", "Skipped"

    ticket = models.ForeignKey(
        OfficialTicket,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="emails",
    )
    kind = models.CharField(max_length=10, choices=Kind.choices)
    event = models.CharField(max_length=40)
    recipients = models.JSONField(default=list)
    subject = models.CharField(max_length=200)
    body = models.TextField()
    state = models.CharField(
        max_length=10, choices=State.choices, default=State.PREPARED
    )
    note = models.TextField(blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.event} — {self.subject}"
