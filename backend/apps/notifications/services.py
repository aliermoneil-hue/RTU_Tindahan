"""Emit a notification. Import this, not the model, from other apps."""

from .models import Notification


def notify(
    user,
    text,
    *,
    kind=Notification.Kind.ORDER,
    link_kind="",
    link_id="",
    actor=None,
):
    """Write one inbox row, or do nothing for a self-notification.

    A missing recipient is not an error: a post whose author was deleted, for
    example, still exists and other members can comment on it.
    """
    if user is None:
        return None
    if actor is not None and getattr(actor, "pk", None) == getattr(user, "pk", None):
        return None
    return Notification.objects.create(
        user=user,
        actor=actor,
        kind=kind,
        text=text[:240],
        link_kind=link_kind,
        link_id=str(link_id)[:64] if link_id else "",
    )


def notify_staff(text, *, kind=Notification.Kind.REPORT, link_kind="freports", link_id="", actor=None):
    """Fan out to every moderator (the report queue's audience)."""
    from apps.accounts.models import User

    sent = []
    for user in User.objects.filter(
        role__in=[User.Role.MODERATOR, User.Role.ADMINISTRATOR], is_active=True
    ):
        row = notify(
            user, text, kind=kind, link_kind=link_kind, link_id=link_id, actor=actor
        )
        if row:
            sent.append(row)
    return sent
