"""Order rules.

Everything that decides whether a request may exist, or may move, lives here so
the HTTP layer stays thin and the tests can call the rules directly.
"""

from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.catalog.models import Listing
from apps.notifications.services import notify

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


def _expiry_for(moment):
    """OT-12: when a request stops waiting. 0 hours switches the clock off."""
    hours = getattr(settings, "ORDER_REQUEST_TTL_HOURS", 0) or 0
    if hours <= 0:
        return None
    return moment + timedelta(hours=hours)


def expire_overdue_requests(*, now=None):
    """Cancel every request whose clock has run out, and tell both sides.

    Run from cron so the database settles quietly, and again on every read of
    the orders list so a buyer never sees a request the seller can no longer
    answer. Each order is locked and re-checked, so a seller who accepts at the
    same moment as the sweep wins rather than being cancelled under their hand.
    """
    moment = now or timezone.now()
    overdue = Order.objects.filter(
        status=Order.Status.REQUESTED, expires_at__isnull=False, expires_at__lte=moment
    )
    expired = []
    for order in overdue.iterator():
        with transaction.atomic():
            locked = Order.objects.select_for_update().get(pk=order.pk)
            if locked.status != Order.Status.REQUESTED or locked.expires_at > moment:
                continue
            locked.status = Order.Status.CANCELLED
            locked.save(update_fields=["status", "updated_at"])
            notify(
                locked.buyer,
                (
                    f"Request {locked.reference} expired: the seller did not answer in time. "
                    "Send it again if you still want the item."
                ),
                kind="order",
                link_kind="order",
                link_id=locked.reference,
            )
            notify(
                locked.seller,
                (
                    f"Request {locked.reference} expired unanswered and was cancelled. "
                    "The item is back on your shelf."
                ),
                kind="order",
                link_kind="shop",
                link_id=locked.reference,
            )
            expired.append(locked.reference)
    return expired


def place_order(
    *,
    buyer,
    lines,
    fulfillment=Listing.Fulfillment.PICKUP,
    meetup_place="",
    meetup_date=None,
    meetup_time="",
    note="",
    payment_method=None,
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
            payment_method=payment_method or Order.Payment.CASH,
            payment_set_by=buyer,
            expires_at=_expiry_for(timezone.now()),
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
    first = order.lines.first()
    notify(
        order.seller,
        f"{buyer.display_name} requested {first.title if first else 'an item'}. Open My shop to accept or decline.",
        kind="order",
        link_kind="shop",
        link_id=order.reference,
        actor=buyer,
    )
    return order


def set_payment_method(order, method, *, by):
    """OT-06: either party may agree how to pay, while the order is still open.

    The platform records the choice and nothing else — no wallet, no gateway, no
    card. A finished order keeps the method it was settled with, because a
    completed record is a record.
    """
    allowed = {Order.Payment.CASH, Order.Payment.P2P}
    if method not in allowed:
        raise ValidationError("Choose cash at the meet-up or a person-to-person transfer.")
    if by.pk not in (order.buyer_id, order.seller_id):
        raise ValidationError("This is not your order.")
    if not order.is_open:
        raise ValidationError("This order is closed, so the payment method stays as it was.")
    if order.payment_method == method:
        return order
    order.payment_method = method
    order.payment_set_by = by
    order.save(update_fields=["payment_method", "payment_set_by", "updated_at"])
    other = order.seller if by.pk == order.buyer_id else order.buyer
    notify(
        other,
        f"{by.display_name} set the payment method to {order.get_payment_method_display()} on {order.reference}.",
        kind="order",
        link_kind="order",
        link_id=order.reference,
        actor=by,
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

    if is_seller:
        notify(
            locked.buyer,
            f"Your request {locked.reference} is now {locked.get_status_display().lower()}.",
            kind="order",
            link_kind="order",
            link_id=locked.reference,
            actor=by,
        )
    else:
        notify(
            locked.seller,
            f"{by.display_name} cancelled request {locked.reference}.",
            kind="order",
            link_kind="shop",
            link_id=locked.reference,
            actor=by,
        )
    return locked
