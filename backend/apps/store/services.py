from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import F, Sum
from django.utils import timezone

from apps.catalog.models import Listing, ListingVariant

from .models import (
    DailyCount,
    EmailOutbox,
    OfficialTicket,
    StockMovement,
    StoreSetting,
    TicketItem,
    TicketStatusHistory,
)

OPEN_STATUSES = [
    OfficialTicket.Status.REQUEST_RECEIVED,
    OfficialTicket.Status.CONFIRMED,
    OfficialTicket.Status.ON_HOLD,
    OfficialTicket.Status.READY_FOR_PICKUP,
]

TRANSITIONS = {
    OfficialTicket.Status.REQUEST_RECEIVED: {
        OfficialTicket.Status.CONFIRMED,
        OfficialTicket.Status.ON_HOLD,
        OfficialTicket.Status.CANCELLED,
    },
    OfficialTicket.Status.CONFIRMED: {
        OfficialTicket.Status.READY_FOR_PICKUP,
        OfficialTicket.Status.ON_HOLD,
        OfficialTicket.Status.CANCELLED,
    },
    OfficialTicket.Status.ON_HOLD: {
        OfficialTicket.Status.CONFIRMED,
        OfficialTicket.Status.READY_FOR_PICKUP,
        OfficialTicket.Status.CANCELLED,
    },
    OfficialTicket.Status.READY_FOR_PICKUP: {
        OfficialTicket.Status.CLAIMED,
        OfficialTicket.Status.ON_HOLD,
        OfficialTicket.Status.CANCELLED,
    },
    OfficialTicket.Status.CLAIMED: set(),
    OfficialTicket.Status.CANCELLED: set(),
}

REASON_REQUIRED = {
    OfficialTicket.Status.ON_HOLD,
    OfficialTicket.Status.CANCELLED,
}


def apply_movement(
    variant: ListingVariant,
    kind: str,
    quantity: int,
    *,
    ticket=None,
    daily_count=None,
    by=None,
    reason="",
):
    """Apply one ledger entry to a locked variant. Call inside transaction.atomic()."""
    if quantity == 0:
        raise ValidationError("Quantity must not be zero.")

    on_hand = variant.on_hand
    available = variant.available

    if kind == StockMovement.Kind.STOCK_IN:
        on_hand += quantity
        available += quantity
    elif kind == StockMovement.Kind.RESERVED:
        available -= quantity
    elif kind == StockMovement.Kind.RELEASED:
        available += quantity
    elif kind == StockMovement.Kind.ISSUED:
        on_hand -= quantity
    elif kind == StockMovement.Kind.SOLD:
        on_hand -= quantity
        available -= quantity
    elif kind == StockMovement.Kind.ADJUSTMENT:
        on_hand += quantity
        available += quantity
    else:
        raise ValidationError("Unknown stock movement type.")

    if on_hand < 0 or available < 0:
        raise ValidationError(
            f"{variant}: not enough stock. On hand {variant.on_hand}, "
            f"available {variant.available}."
        )
    if available > on_hand:
        raise ValidationError(f"{variant}: cannot release more units than are reserved.")

    variant.on_hand = on_hand
    variant.available = available
    variant.save(update_fields=["on_hand", "available", "updated_at"])

    return StockMovement.objects.create(
        variant=variant,
        ticket=ticket,
        daily_count=daily_count,
        kind=kind,
        quantity=quantity,
        reason=reason,
        created_by=by,
        on_hand_after=on_hand,
        available_after=available,
    )


def record_stock_in(variant, quantity, *, by=None, reason="New stock received"):
    quantity = int(quantity)
    if quantity < 1:
        raise ValidationError("Stock in must be at least 1.")
    with transaction.atomic():
        locked = ListingVariant.objects.select_for_update().get(pk=variant.pk)
        return apply_movement(
            locked,
            StockMovement.Kind.STOCK_IN,
            quantity,
            by=by,
            reason=reason,
        )


def place_official_order(
    *,
    buyer,
    items,
    pickup_date=None,
    claim_notes="",
    created_by=None,
):
    """Create a ticket and reserve stock. items = [{listing, variant, quantity}]."""
    if not buyer.is_verified:
        raise ValidationError("Verify your RTU email before ordering.")
    if not items:
        raise ValidationError("Add at least one item.")

    setting = StoreSetting.get_solo()

    if setting.ordering_window_enabled:
        now = timezone.localtime().time()
        if (
            setting.ordering_window_start
            and setting.ordering_window_end
            and not (setting.ordering_window_start <= now <= setting.ordering_window_end)
        ):
            raise ValidationError("The Official Store is closed right now.")

    total_quantity = sum(int(row["quantity"]) for row in items)
    if (
        setting.max_quantity_per_ticket
        and total_quantity > setting.max_quantity_per_ticket
    ):
        raise ValidationError(
            f"At most {setting.max_quantity_per_ticket} units per ticket."
        )

    if setting.max_quantity_per_student:
        existing = (
            TicketItem.objects.filter(
                ticket__buyer=buyer, ticket__status__in=OPEN_STATUSES
            ).aggregate(total=Sum("quantity"))["total"]
            or 0
        )
        if existing + total_quantity > setting.max_quantity_per_student:
            raise ValidationError(
                f"At most {setting.max_quantity_per_student} units per student "
                "across open tickets."
            )

    with transaction.atomic():
        ticket = OfficialTicket.objects.create(
            buyer=buyer,
            pickup_date=pickup_date,
            claim_notes=claim_notes,
        )

        for row in items:
            listing = row["listing"]
            variant = row.get("variant")
            quantity = int(row["quantity"])

            if not listing.is_official:
                raise ValidationError("Only official items can be ordered here.")
            if variant is None:
                raise ValidationError(f"Choose a size or type for {listing.title}.")
            if quantity < 1:
                raise ValidationError("Quantity must be at least 1.")

            locked = (
                ListingVariant.objects.select_for_update()
                .select_related("listing")
                .get(pk=variant.pk)
            )
            if locked.listing_id != listing.id:
                raise ValidationError("That variant does not belong to the listing.")
            if not locked.is_active:
                raise ValidationError(f"{locked} is not available.")

            TicketItem.objects.create(
                ticket=ticket,
                listing=listing,
                variant=locked,
                quantity=quantity,
                unit_price=locked.unit_price,
            )
            apply_movement(
                locked,
                StockMovement.Kind.RESERVED,
                quantity,
                ticket=ticket,
                by=created_by,
                reason="Student request received",
            )

        TicketStatusHistory.objects.create(
            ticket=ticket,
            from_status="",
            to_status=OfficialTicket.Status.REQUEST_RECEIVED,
            changed_by=created_by,
            note="Ticket created",
        )

    return ticket


def change_ticket_status(ticket, new_status, *, by=None, note=""):
    """Move a ticket through the allowed status graph and adjust stock."""
    with transaction.atomic():
        ticket = OfficialTicket.objects.select_for_update().get(pk=ticket.pk)

        if new_status not in TRANSITIONS.get(ticket.status, set()):
            raise ValidationError(
                f"Cannot change {ticket.get_status_display()} to {new_status}."
            )
        if new_status in REASON_REQUIRED and not note.strip():
            raise ValidationError("A reason is required for this status.")

        if new_status in {
            OfficialTicket.Status.CANCELLED,
            OfficialTicket.Status.CLAIMED,
        }:
            kind = (
                StockMovement.Kind.RELEASED
                if new_status == OfficialTicket.Status.CANCELLED
                else StockMovement.Kind.ISSUED
            )
            reason = (
                "Request cancelled"
                if new_status == OfficialTicket.Status.CANCELLED
                else "Claimed at the counter"
            )
            for item in ticket.items.select_related("variant").order_by("variant_id"):
                if item.variant_id:
                    locked = ListingVariant.objects.select_for_update().get(
                        pk=item.variant_id
                    )
                    apply_movement(
                        locked,
                        kind,
                        item.quantity,
                        ticket=ticket,
                        by=by,
                        reason=reason,
                    )

            if new_status == OfficialTicket.Status.CLAIMED:
                # A claimed ticket is a completed sale, so the catalogue's
                # sales counter moves here. It feeds the "best-selling"
                # ordering; a cancelled ticket must not touch it, and a
                # claimed ticket has no way back out of that status.
                for item in ticket.items.all():
                    Listing.objects.filter(pk=item.listing_id).update(
                        sold_count=F("sold_count") + item.quantity
                    )

        TicketStatusHistory.objects.create(
            ticket=ticket,
            from_status=ticket.status,
            to_status=new_status,
            changed_by=by,
            note=note,
        )
        ticket.status = new_status
        ticket.processed_by = by or ticket.processed_by
        if new_status == OfficialTicket.Status.CANCELLED:
            ticket.cancelled_reason = note
        ticket.save(
            update_fields=[
                "status",
                "processed_by",
                "cancelled_reason",
                "updated_at",
            ]
        )

    return ticket


def record_daily_count(variant, counted_quantity, *, by=None, reason="", counted_on=None):
    """Compare a physical count with On Hand and write the difference as an adjustment."""
    with transaction.atomic():
        locked = ListingVariant.objects.select_for_update().get(pk=variant.pk)
        expected = locked.on_hand
        difference = int(counted_quantity) - expected

        if difference != 0 and not reason.strip():
            raise ValidationError("A reason is required when the count differs.")

        count = DailyCount.objects.create(
            variant=locked,
            counted_on=counted_on or timezone.localdate(),
            expected_on_hand=expected,
            counted_quantity=int(counted_quantity),
            difference=difference,
            reason=reason,
            counted_by=by,
        )
        if difference:
            apply_movement(
                locked,
                StockMovement.Kind.ADJUSTMENT,
                difference,
                daily_count=count,
                by=by,
                reason=f"Daily count {count.pk}: {reason}",
            )
        return count


def prepare_email(*, ticket=None, kind, event, recipients, subject, body, note=""):
    """Write to the outbox. Nothing is sent."""
    return EmailOutbox.objects.create(
        ticket=ticket,
        kind=kind,
        event=event,
        recipients=recipients,
        subject=subject,
        body=body,
        note=note,
    )
