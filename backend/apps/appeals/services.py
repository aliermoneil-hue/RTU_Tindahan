"""The rules for filing and deciding an appeal, in one place."""

from django.core.exceptions import ValidationError
from django.utils import timezone

from apps.audit.services import record
from apps.catalog.models import Listing
from apps.forum.models import ForumComment, ForumPost
from apps.notifications.services import notify

from .models import Appeal


def _original_decider(kind, target):
    """Whoever decided against the appellant, when the record says who.

    A hidden post or comment names its moderator directly. A listing does not
    carry the field, so the audit trail — which every moderation action writes —
    is asked instead; no entry means no named decider, and the separation rule
    then simply has nothing to exclude.
    """
    if kind in (Appeal.Kind.POST, Appeal.Kind.COMMENT):
        return target.hidden_by if target is not None else None
    if kind == Appeal.Kind.LISTING and target is not None:
        from apps.audit.models import AuditLog

        entry = (
            AuditLog.objects.filter(
                target_type__in=("listing", "Listing"),
                target_id__in=(str(target.pk), target.slug),
            )
            .exclude(actor__isnull=True)
            .order_by("-created_at")
            .first()
        )
        return entry.actor if entry else None
    return None


def open_appeal(*, appellant, kind, reason, listing=None, post=None, comment=None):
    """File an appeal, or explain in plain words why it cannot be filed."""
    reason = (reason or "").strip()
    if len(reason) < 10:
        raise ValidationError("Write a sentence or two so the reviewer knows what to look at.")

    target = None
    decider = None
    if kind == Appeal.Kind.LISTING:
        target = listing
        if target is None:
            raise ValidationError("Choose the listing you are appealing.")
        if target.seller_id != appellant.pk:
            raise ValidationError("You can only appeal a decision about your own listing.")
        if (
            target.moderation_status != Listing.ModerationStatus.REJECTED
            and target.availability_status != Listing.AvailabilityStatus.REMOVED
        ):
            raise ValidationError("That listing has not been rejected or removed.")
        decider = _original_decider(kind, target)
    elif kind in (Appeal.Kind.POST, Appeal.Kind.COMMENT):
        target = post if kind == Appeal.Kind.POST else comment
        if target is None:
            raise ValidationError("Choose the content you are appealing.")
        if target.author_id != appellant.pk:
            raise ValidationError("You can only appeal a decision about your own content.")
        if not target.is_hidden:
            raise ValidationError("That content has not been removed.")
        decider = _original_decider(kind, target)
    elif kind == Appeal.Kind.ACCOUNT:
        if appellant.status == appellant.Status.ACTIVE:
            raise ValidationError("Your account is not suspended, so there is nothing to appeal.")
    else:
        raise ValidationError("Choose what you are appealing.")

    open_states = (Appeal.Status.PENDING, Appeal.Status.GRANTED)
    duplicate = Appeal.objects.filter(
        appellant=appellant, kind=kind, status__in=open_states
    ).filter(
        listing=target if kind == Appeal.Kind.LISTING else None,
        post=target if kind == Appeal.Kind.POST else None,
        comment=target if kind == Appeal.Kind.COMMENT else None,
    )
    if duplicate.exists():
        raise ValidationError(
            "You already have an appeal about this. Wait for the decision before filing another."
        )

    return Appeal.objects.create(
        appellant=appellant,
        kind=kind,
        listing=listing if kind == Appeal.Kind.LISTING else None,
        post=post if kind == Appeal.Kind.POST else None,
        comment=comment if kind == Appeal.Kind.COMMENT else None,
        original_decider=decider,
        reason=reason,
    )


def decide_appeal(*, appeal, by, grant, note):
    """Decide an appeal, apply the outcome, and leave a trace of both."""
    if appeal.status != Appeal.Status.PENDING:
        raise ValidationError("That appeal has already been decided.")
    note = (note or "").strip()
    if not note:
        raise ValidationError("Give a reason: the appellant is told what you decided and why.")
    if by.pk == appeal.appellant_id:
        raise ValidationError("You cannot decide your own appeal.")
    if appeal.original_decider_id and by.pk == appeal.original_decider_id:
        raise ValidationError(
            "The person who made the original decision cannot review the appeal."
        )

    note = note[:600]
    appeal.status = Appeal.Status.GRANTED if grant else Appeal.Status.DENIED
    appeal.decided_by = by
    appeal.decided_at = timezone.now()
    appeal.decision_note = note

    if grant:
        _undo(appeal)
    appeal.save(update_fields=["status", "decided_by", "decided_at", "decision_note"])

    record(
        by,
        f"appeal.{'granted' if grant else 'denied'}",
        target_type="appeal",
        target_id=appeal.pk,
        target_name=appeal.target_label,
        note=note,
    )
    notify(
        appeal.appellant,
        (
            f"Your appeal was granted. {note}"
            if grant
            else f"Your appeal was refused. {note}"
        ),
        kind="system",
        link_kind="appeals",
        link_id=appeal.pk,
        actor=by,
    )
    return appeal


def _undo(appeal):
    """Put the thing back the way the appellant asked for."""
    if appeal.kind == Appeal.Kind.LISTING and appeal.listing_id:
        listing = appeal.listing
        listing.moderation_status = Listing.ModerationStatus.APPROVED
        if listing.availability_status == Listing.AvailabilityStatus.REMOVED:
            listing.availability_status = Listing.AvailabilityStatus.AVAILABLE
        listing.save(update_fields=["moderation_status", "availability_status"])
    elif appeal.kind == Appeal.Kind.POST and appeal.post_id:
        post = appeal.post
        post.hidden_by = None
        post.hidden_at = None
        post.save(update_fields=["hidden_by", "hidden_at"])
    elif appeal.kind == Appeal.Kind.COMMENT and appeal.comment_id:
        comment = appeal.comment
        comment.hidden_by = None
        comment.hidden_at = None
        comment.save(update_fields=["hidden_by", "hidden_at"])
    elif appeal.kind == Appeal.Kind.ACCOUNT:
        user = appeal.appellant
        user.status = user.Status.ACTIVE
        user.is_active = True
        user.save(update_fields=["status", "is_active"])
