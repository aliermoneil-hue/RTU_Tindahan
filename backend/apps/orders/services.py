"""Order rules.

Everything that decides whether a request may exist, or may move, lives here so
the HTTP layer stays thin and the tests can call the rules directly.
"""

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.catalog.models import Listing

from .models import Order, OrderLine

# Who may move an order, and where to. Buyer actions and seller actions are
# separated so a seller can never play the buyer and vice versa.
SELLER_TRANSITIONS = {
    Order.Status.REQUESTED: {Order.Status.ACCEPTED, Order.Status.DECLINED},
    Order.Status.ACCEPTED: {Order.Status.COMPLETED},
}
BUYER_TRANSITIONS = {
    Order.Status.REQUESTED: {Order.Status.CANCELLED},
    Order.Status.ACCEPTED: {Order.Status.CANCELLED},
}
SELLER_ACTIONS = {Order.Status.ACCEPTED, Order.Status.DECLINED, Order.Status.COMPLETED}


def _next_reference(day):
    prefix = f"ORD-{day:%y%m%d}-"
    today = Order.objects.filter(reference__startswith=prefix).count() + 1
    return f"{prefix}{today:03d}"


def place_order(
    *,
    buyer,
    lines,
    fulfillment=Listing.Fulfillment.PICKUP,
    meetup_place="",
    meetup_date=None,
    meetup_time="",
    note="",
):
    """lines = [{"listing": <Listing>, "quantity": int}], all from one seller."""
    if not getattr(buyer, "is_verified", False):
        raise ValidationError("Verify your RTU email before sending a request.")
    if not lines:
        raise ValidationError("Add at least one item.")

    sellers = {row["listing"].seller_id for row in lines}
    if len(sellers) != 1:
        raise ValidationError("Send one request per seller.")
    seller_id = sellers.pop()
    if seller_id == buyer.pk:
        raise ValidationError("You cannot request your own listing.")

    for row in lines:
        listing = row["listing"]
        quantity = int(row["quantity"])
        if quantity < 1:
            raise ValidationError("Quantity must be at least 1.")
        if listing.moderation_status != Listing.ModerationStatus.APPROVED:
            raise ValidationError(f"{listing.title} is not available yet.")
        if listing.availability_status != Listing.AvailabilityStatus.AVAILABLE:
            raise ValidationError(f"{listing.title} is no longer available.")
        if listing.listing_type == Listing.Type.PRODUCT and quantity > listing.quantity:
            raise ValidationError(f"Only {listing.quantity} of {listing.title} left.")

    with transaction.atomic():
        order = Order.objects.create(
            reference=_next_reference(timezone.localdate()),
            buyer=buyer,
            seller_id=seller_id,
            fulfillment=fulfillment,
            meetup_place=meetup_place[:200],
            meetup_date=meetup_date,
            meetup_time=meetup_time[:40],
            note=note,
        )
        for row in lines:
            listing = row["listing"]
            OrderLine.objects.create(
                order=order,
                listing=listing,
                title=listing.title,
                quantity=int(row["quantity"]),
                unit_price=listing.price,
            )
    return order


def change_order_status(order, new_status, *, by):
    """Move an order along, refusing anything the caller's role may not do."""
    is_seller = by.pk == order.seller_id
    is_buyer = by.pk == order.buyer_id
    if not (is_seller or is_buyer):
        raise ValidationError("This is not your order.")

    if new_status in SELLER_ACTIONS:
        if not is_seller:
            raise ValidationError("Only the seller can accept, decline or complete an order.")
        allowed = SELLER_TRANSITIONS.get(order.status, set())
    else:
        if new_status != Order.Status.CANCELLED:
            raise ValidationError("That is not a status you can set.")
        if not (is_buyer or is_seller):
            raise ValidationError("You cannot cancel this order.")
        allowed = BUYER_TRANSITIONS.get(order.status, set())

    if new_status not in allowed:
        raise ValidationError(
            f"Cannot change {order.get_status_display().lower()} to {new_status}."
        )

    with transaction.atomic():
        locked = Order.objects.select_for_update().get(pk=order.pk)
        if new_status == Order.Status.COMPLETED:
            # The sale is real now: the stock leaves the listing.
            for line in locked.lines.select_related("listing"):
                listing = Listing.objects.select_for_update().get(pk=line.listing_id)
                listing.quantity = max(0, listing.quantity - line.quantity)
                listing.sold_count = (listing.sold_count or 0) + line.quantity
                if listing.quantity == 0:
                    listing.availability_status = Listing.AvailabilityStatus.SOLD
                listing.save(
                    update_fields=["quantity", "sold_count", "availability_status"]
                )
        locked.status = new_status
        if new_status in {Order.Status.ACCEPTED, Order.Status.DECLINED, Order.Status.COMPLETED}:
            locked.decided_at = timezone.now()
        locked.save(update_fields=["status", "decided_at", "updated_at"])
    return locked
