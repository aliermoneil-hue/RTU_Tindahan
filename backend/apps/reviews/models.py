"""Ratings written by a buyer after a completed order.

A review hangs off the order it came from, which is what makes it verifiable:
"verified pickup" on the product page is not a label the client can invent.
Two shapes share one table:

  listing is set   an item review, one per order per listing
  listing is null  a seller review, one per order

The partial unique constraints enforce both, so a double submit updates the
existing row instead of piling up duplicates.
"""

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Review(models.Model):
    order = models.ForeignKey(
        "orders.Order",
        on_delete=models.CASCADE,
        related_name="reviews",
    )
    buyer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="reviews_written",
    )
    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="reviews_received",
    )
    # Null means the review is about the seller, not one of their listings.
    listing = models.ForeignKey(
        "catalog.Listing",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="reviews",
    )
    stars = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    text = models.TextField(blank=True, max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    # Set only when the buyer changes an existing rating. The UI shows
    # "edited"; a created_at/updated_at comparison would call a fast create an
    # edit and miss two edits inside the same second.
    edited_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["listing", "-created_at"]),
            models.Index(fields=["seller", "-created_at"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["order", "listing"],
                condition=models.Q(listing__isnull=False),
                name="review_one_per_order_item",
            ),
            models.UniqueConstraint(
                fields=["order"],
                condition=models.Q(listing__isnull=True),
                name="review_one_per_order_seller",
            ),
            models.CheckConstraint(
                condition=~models.Q(buyer=models.F("seller")),
                name="review_buyer_is_not_seller",
            ),
        ]

    @property
    def kind(self):
        return "item" if self.listing_id else "seller"

    @property
    def was_edited(self):
        return self.edited_at is not None

    def __str__(self):
        target = self.listing or self.seller
        return f"{self.order.reference}: {self.stars}/5 for {target}"
