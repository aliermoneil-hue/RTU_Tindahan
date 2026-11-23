from .models import AuditLog


def record(actor, action, *, target_type, target_id="", target_name="", note=""):
    """Append one staff action. Never raises for a missing actor."""
    return AuditLog.objects.create(
        actor=actor if getattr(actor, "pk", None) else None,
        action=action[:60],
        target_type=target_type[:30],
        target_id=str(target_id)[:64] if target_id else "",
        target_name=str(target_name)[:150] if target_name else "",
        note=str(note)[:300] if note else "",
    )
