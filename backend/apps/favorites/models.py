"""A member's saved listings and saved sellers.

Favorites used to live only in the browser snapshot, so the heart on a product
meant nothing on the next device and nothing to the seller. One row is one
saved target: either a listing or a seller, never both. The pair of partial
unique constraints keeps a fast double click from writing two rows, and the
check constraint keeps the "exactly one target" rule true in the database as
well as in the serializer.
"""

from django.conf import settings
from django.db import models


class Favorite(models.Model):
    class Kind(models.TextChoices):
        LISTING = "listing", "Listing"
        SELLER = "seller", "Seller"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="favorites",
    )
    listing = models.ForeignKey(
        "catalog.Listing",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="favorited_by",
    )
    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="favorited_as_seller",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "-created_at"])]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(listing__isnull=False, seller__isnull=True)
                    | models.Q(listing__isnull=True, seller__isnull=False)
                ),
                name="favorite_exactly_one_target",
            ),
            models.UniqueConstraint(
                fields=["user", "listing"],
                condition=models.Q(listing__isnull=False),
                name="favorite_unique_listing",
            ),
            models.UniqueConstraint(
                fields=["user", "seller"],
                condition=models.Q(seller__isnull=False),
                name="favorite_unique_seller",
            ),
            models.CheckConstraint(
                condition=~models.Q(user=models.F("seller")),
                name="favorite_seller_is_not_self",
            ),
        ]

    @property
    def kind(self):
        return self.Kind.LISTING if self.listing_id else self.Kind.SELLER

    def __str__(self):
        target = self.listing or self.seller
        return f"{self.user.email} -> {target}"
