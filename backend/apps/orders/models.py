from django.conf import settings
from django.db import models

from apps.catalog.models import Listing


class Order(models.Model):
    """One buyer's request to one seller, for one or more of their listings."""

    class Status(models.TextChoices):
        REQUESTED = "requested", "Requested"
        ACCEPTED = "accepted", "Accepted"
        DECLINED = "declined", "Declined"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    reference = models.CharField(max_length=24, unique=True, blank=True)
    buyer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="orders_placed"
    )
    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="orders_received"
    )
    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.REQUESTED, db_index=True
    )
    # Copied from the listing at request time: what the buyer picked.
    fulfillment = models.CharField(
        max_length=10,
        choices=Listing.Fulfillment.choices,
        default=Listing.Fulfillment.PICKUP,
    )
    class Payment(models.TextChoices):
        # OT-06: the platform records the choice and handles no money. There is
        # no online payment and no wallet balance — cash changes hands at the
        # meet-up, or the two students transfer to each other directly.
        CASH = "cash", "Cash at the campus meet-up"
        P2P = "p2p", "Person-to-person transfer (GCash, Maya or bank)"

    payment_method = models.CharField(
        max_length=8, choices=Payment.choices, default=Payment.CASH
    )
    payment_set_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="payment_choices_made",
    )
    meetup_place = models.CharField(max_length=200, blank=True)
    meetup_date = models.DateField(null=True, blank=True)
    meetup_time = models.CharField(max_length=40, blank=True)
    note = models.TextField(blank=True)
    decided_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["seller", "status"]),
            models.Index(fields=["buyer", "status"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=~models.Q(buyer=models.F("seller")),
                name="order_buyer_is_not_seller",
            )
        ]

    def __str__(self):
        return f"{self.reference} ({self.status})"

    @property
    def total_amount(self):
        return sum(line.line_total for line in self.lines.all())

    @property
    def is_open(self):
        return self.status in {self.Status.REQUESTED, self.Status.ACCEPTED}


class OrderLine(models.Model):
    """A listing and how many of it the buyer asked for, priced at request time."""

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="lines")
    listing = models.ForeignKey(Listing, on_delete=models.PROTECT, related_name="order_lines")
    title = models.CharField(max_length=170)
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        ordering = ["id"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(quantity__gte=1), name="order_line_quantity_min_1"
            )
        ]

    def __str__(self):
        return f"{self.quantity} x {self.title}"

    @property
    def line_total(self):
        return self.unit_price * self.quantity
