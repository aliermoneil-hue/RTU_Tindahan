"""The Official Store's prepared mail (EM-01 to EM-06, NT-02).

Nothing in this module sends anything. It writes rows to the outbox — what the
office would send if the sending switch were on — which is exactly what EM-05
asks for and what the Email outbox screen reads.

The rules that shape a message:

  EM-02  a student message goes only to an RTU address; with none, the row is
         marked Skipped and says why.
  EM-03  a student message carries the reference, status, items, pickup date and
         claim notes; it never carries the student number, the name, or a
         payment link, and it says it is automatic.
  EM-04  a low stock message goes to the staff addresses in the settings; with
         none, it is Skipped.
  EM-06  the outbox keeps the newest 500 rows.

The body is plain text on purpose: an HTML body invites tracking pixels and a
"click here" that a locked switch cannot honour.
"""

from django.conf import settings
from django.utils import timezone

from .models import EmailOutbox, OfficialTicket, StoreSetting

OUTBOX_LIMIT = 500

AUTOMATIC_NOTE = "This message is automatic. Please do not reply to it."


def _rtu_domain() -> str:
    return (getattr(settings, "RTU_EMAIL_DOMAIN", "rtu.edu.ph") or "rtu.edu.ph").lower()


def _is_rtu_address(email: str) -> bool:
    return bool(email) and email.strip().lower().endswith("@" + _rtu_domain())


def _ticket_items(ticket) -> list[str]:
    """One line per item: quantity, name and size. No prices, no student data."""
    lines = []
    for item in ticket.items.select_related("listing", "variant"):
        size = f" ({item.variant.name})" if item.variant_id else ""
        lines.append(f"- {item.quantity} x {item.listing.title}{size}")
    return lines


def ticket_message(ticket) -> dict:
    """The message a student receives for this ticket's current status."""
    status = ticket.get_status_display()
    subject = f"RTU Official Store: {ticket.reference} — {status}"

    body_lines = [
        f"Reference: {ticket.reference}",
        f"Status: {status}",
        "",
        "Items:",
        *_ticket_items(ticket),
        "",
        f"Pickup date: {ticket.pickup_date.isoformat() if ticket.pickup_date else 'To be confirmed'}",
    ]
    if ticket.claim_notes.strip():
        body_lines.append(f"Claim notes: {ticket.claim_notes.strip()}")
    if ticket.cancelled_reason.strip():
        body_lines.append(f"Reason: {ticket.cancelled_reason.strip()}")
    body_lines += [
        "",
        "Pick up at the BAO window on campus and bring your RTU ID.",
        "Payment is made in person at the counter; this message has no payment link.",
        "",
        AUTOMATIC_NOTE,
    ]
    return {"subject": subject[:200], "body": "\n".join(body_lines)}


def prepare_ticket_email(ticket, *, event: str = "") -> EmailOutbox:
    """Write the student's message for this ticket into the outbox."""
    address = (ticket.buyer.email or "").strip()
    message = ticket_message(ticket)

    if _is_rtu_address(address):
        row = EmailOutbox.objects.create(
            ticket=ticket,
            kind=EmailOutbox.Kind.STUDENT,
            event=event or ticket.status,
            recipients=[address],
            subject=message["subject"],
            body=message["body"],
            state=EmailOutbox.State.PREPARED,
        )
    else:
        row = EmailOutbox.objects.create(
            ticket=ticket,
            kind=EmailOutbox.Kind.STUDENT,
            event=event or ticket.status,
            recipients=[],
            subject=message["subject"],
            body=message["body"],
            state=EmailOutbox.State.SKIPPED,
            note="No RTU email address on the account, so the message is skipped (EM-02).",
        )

    _prune()
    return row


def prepare_low_stock_email(variant) -> EmailOutbox | None:
    """EM-04: tell the office a size is running out. Skipped without an address."""
    setting = StoreSetting.get_solo()
    threshold = int(setting.low_stock_threshold or 0)
    if threshold <= 0 or variant.on_hand > threshold:
        return None

    recipients = [
        address.strip()
        for address in (setting.low_stock_emails or [])
        if _is_rtu_address(address)
    ]
    name = variant.listing.title
    label = f" ({variant.name})" if variant.name else ""
    subject = f"Low stock: {name}{label}"
    body = "\n".join(
        [
            f"Item: {name}{label}",
            f"On hand: {variant.on_hand}",
            f"Threshold: {threshold}",
            "",
            "Restock at the BAO window, or turn the item off until it arrives.",
            "",
            AUTOMATIC_NOTE,
        ]
    )

    row = EmailOutbox.objects.create(
        kind=EmailOutbox.Kind.STAFF,
        event="low_stock",
        recipients=recipients,
        subject=subject[:200],
        body=body,
        state=EmailOutbox.State.PREPARED if recipients else EmailOutbox.State.SKIPPED,
        note="" if recipients else "No staff address is set in the store settings (EM-04).",
    )
    _prune()
    return row


def _prune() -> None:
    """EM-06: keep the newest OUTBOX_LIMIT rows, drop the rest."""
    stale = EmailOutbox.objects.order_by("-created_at").values_list("pk", flat=True)[
        OUTBOX_LIMIT:
    ]
    stale = list(stale)
    if stale:
        EmailOutbox.objects.filter(pk__in=stale).delete()


def ticket_event_label(ticket, status: str) -> str:
    """A stable event name per status, for filtering the outbox."""
    names = {
        OfficialTicket.Status.REQUEST_RECEIVED: "request_received",
        OfficialTicket.Status.CONFIRMED: "confirmed",
        OfficialTicket.Status.ON_HOLD: "on_hold",
        OfficialTicket.Status.READY_FOR_PICKUP: "ready_for_pickup",
        OfficialTicket.Status.CLAIMED: "claimed",
        OfficialTicket.Status.CANCELLED: "cancelled",
    }
    return names.get(status, status)
