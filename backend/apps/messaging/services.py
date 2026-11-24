"""Reporting a conversation, and the narrow view a moderator is given (MS-04, MS-05).

The privacy line is the point: a report carries the message it is about, copied
at the moment it is filed, and a moderator's screen shows that and nothing else
from the thread. The conversation's other messages are never selected, so a
private exchange cannot be read to find something else to act on.
"""

from django.core.exceptions import ValidationError
from django.utils import timezone

from apps.audit.services import record
from apps.notifications.services import notify, notify_staff

from .models import ConversationReport, Message


def report_conversation(*, reporter, conversation, reason, details="", message=None):
    """File a report about a thread, or one message in it."""
    if reporter.pk not in {conversation.buyer_id, conversation.seller_id}:
        raise ValidationError("You can only report a conversation you are part of.")
    if reason not in ConversationReport.Reason.values:
        raise ValidationError("Choose a reason for the report.")

    reported = (
        conversation.seller
        if reporter.pk == conversation.buyer_id
        else conversation.buyer
    )

    snapshot_body = ""
    snapshot_at = None
    if message is not None:
        if message.conversation_id != conversation.pk:
            raise ValidationError("That message is not part of this conversation.")
        if message.sender_id == reporter.pk:
            raise ValidationError("You cannot report your own message.")
        snapshot_body = message.body
        snapshot_at = message.created_at
        if message.sender_id:
            reported = message.sender

    already = ConversationReport.objects.filter(
        conversation=conversation,
        reporter=reporter,
        message=message,
        status=ConversationReport.Status.RECEIVED,
    )
    if already.exists():
        raise ValidationError("You have already reported this; it is waiting for review.")

    report = ConversationReport.objects.create(
        conversation=conversation,
        message=message,
        reporter=reporter,
        reported_user=reported,
        reason=reason,
        details=(details or "").strip()[:600],
        snapshot_body=snapshot_body,
        snapshot_at=snapshot_at,
    )
    # The reported person is not told a report exists: naming it invites
    # retaliation, and the reporter's identity is the thing RM-07 protects.
    # Staff are the ones who need to know something is waiting.
    notify_staff(
        "A conversation was reported and is waiting for review.",
        kind="report",
        link_kind="msgreports",
        link_id=report.pk,
        actor=reporter,
    )
    return report


def resolve_report(*, report, by, action, note=""):
    """A moderator's decision on a report, with the action it carries."""
    if report.status == ConversationReport.Status.RESOLVED:
        raise ValidationError("That report has already been handled.")
    if action not in ConversationReport.Action.values:
        raise ValidationError("Choose what to do with the report.")
    if by.pk == report.reporter_id:
        raise ValidationError("You cannot decide a report you filed.")
    note = (note or "").strip()
    if action != ConversationReport.Action.DISMISS and not note:
        raise ValidationError("Say what the sender is being told, so the record has a reason.")

    report.action = action
    report.handled_by = by
    report.handled_at = timezone.now()
    report.note = note[:600]
    # RM-02: the status says Resolved; the resolution says what that meant.
    report.status = ConversationReport.Status.RESOLVED
    report.resolution = (
        ConversationReport.Resolution.DISMISSED
        if action == ConversationReport.Action.DISMISS
        else ConversationReport.Resolution.ACTIONED
    )
    report.save(
        update_fields=[
            "action",
            "handled_by",
            "handled_at",
            "note",
            "status",
            "resolution",
        ]
    )

    if action == ConversationReport.Action.WARN:
        notify(
            report.reported_user,
            f"A moderator reviewed a report about your messages and sent you a warning: {note}",
            kind="report",
            link_kind="messages",
            link_id=f"cv-{report.conversation_id}",
            actor=by,
        )
    elif action == ConversationReport.Action.SUSPEND:
        user = report.reported_user
        user.status = user.Status.SUSPENDED
        user.is_active = False
        user.save(update_fields=["status", "is_active"])
        notify(
            report.reported_user,
            (
                "Your account was suspended after a review of a reported conversation. "
                f"Reason: {note}"
            ),
            kind="report",
            link_kind="",
            link_id="",
            actor=by,
        )

    notify(
        report.reporter,
        (
            "Your report was reviewed and dismissed."
            if action == ConversationReport.Action.DISMISS
            else "Your report was reviewed and action was taken."
        ),
        kind="report",
        link_kind="messages",
        link_id=f"cv-{report.conversation_id}",
        actor=by,
    )

    record(
        by,
        f"conversation.report.{action}",
        target_type="conversation",
        target_id=report.conversation_id,
        target_name=f"report {report.pk}",
        note=note,
    )
    return report


def reported_messages(report):
    """The only messages a moderator may read for this report.

    One message when the report names one — the copy taken when it was filed.
    When the whole thread was reported there is nothing to single out, so the
    reporter's own description (`details`) is what the moderator reads; the
    thread itself stays closed.
    """
    if report.message_id:
        return [
            {
                "body": report.snapshot_body,
                "sent_at": report.snapshot_at,
                "sender": _name(report.reported_user),
            }
        ]
    return []


def _name(user):
    return user.display_name if user is not None else "RTU Tindahan"
