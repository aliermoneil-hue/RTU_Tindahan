"""
Login lockout logic (SE-05).

Tracks failed login attempts per email in the database and applies cooldowns
and restrictions so that brute-force guessing cannot proceed at speed.

All times are server-side (django.utils.timezone.now).  The client never
sends a timestamp that is trusted.
"""

import logging
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import F
from django.utils import timezone

from .models import LoginAttempt

logger = logging.getLogger(__name__)


class Lock:
    """A currently-active lock on an email address."""

    __slots__ = ("kind", "retry_after")

    def __init__(self, kind: str, retry_after: int):
        self.kind = kind  # "cooldown" or "restricted"
        self.retry_after = retry_after  # whole seconds, at least 1


class FailureResult:
    """Outcome of recording a failed attempt."""

    __slots__ = ("locked", "kind", "retry_after", "attempts_left", "next_penalty")

    def __init__(
        self,
        locked: bool,
        kind: str | None = None,
        retry_after: int | None = None,
        attempts_left: int | None = None,
        next_penalty: str | None = None,
    ):
        self.locked = locked
        self.kind = kind
        self.retry_after = retry_after
        self.attempts_left = attempts_left
        self.next_penalty = next_penalty


def _now() -> timezone.datetime:
    return timezone.now()


def _normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def _cooldown_after() -> int:
    return int(getattr(settings, "LOGIN_COOLDOWN_AFTER", 5))


def _cooldown_seconds() -> int:
    return int(getattr(settings, "LOGIN_COOLDOWN_SECONDS", 60))


def _restrict_after() -> int:
    return int(getattr(settings, "LOGIN_RESTRICT_AFTER", 7))


def _restrict_seconds() -> int:
    return int(getattr(settings, "LOGIN_RESTRICT_SECONDS", 900))


def _window_hours() -> int:
    return int(getattr(settings, "LOGIN_ATTEMPT_WINDOW_HOURS", 24))


def current_lock(email: str) -> Lock | None:
    """Return an active lock for the email, or None if it is not locked.

    If a lock has expired:
      - For a restriction: reset failed_count to 0 and clear the lock.
      - For a cooldown: keep the count (so the next failures reach 6 and 7),
        just clear the locked_until so the address can try again.
    """
    email = _normalize_email(email)
    try:
        attempt = LoginAttempt.objects.get(email=email)
    except LoginAttempt.DoesNotExist:
        return None

    locked_until = attempt.locked_until
    if locked_until is not None and locked_until > _now():
        remaining = int((locked_until - _now()).total_seconds())
        return Lock(
            kind="restricted" if attempt.failed_count >= _restrict_after() else "cooldown",
            retry_after=max(1, remaining),
        )

    # A lock that has expired.
    if locked_until is not None:
        if attempt.failed_count >= _restrict_after():
            # Restriction expired: reset everything.
            attempt.failed_count = 0
            attempt.locked_until = None
            attempt.last_failed_at = None
        else:
            # Cooldown expired: keep the count, just clear the lock.
            attempt.locked_until = None
        attempt.save(
            update_fields=["failed_count", "locked_until", "last_failed_at", "updated_at"]
        )
    return None


def record_failure(email: str) -> FailureResult:
    """Record one failed login attempt for the email.

    Runs inside ``transaction.atomic()`` with ``select_for_update()`` so that
    parallel requests cannot skip the count.

    Resets a stale count first (older than LOGIN_ATTEMPT_WINDOW_HOURS), then
    increments ``failed_count`` and decides whether to cooldown, restrict, or
    just report how many attempts are left.
    """
    email = _normalize_email(email)

    with transaction.atomic():
        attempt, created = LoginAttempt.objects.select_for_update().get_or_create(
            email=email,
            defaults={
                "failed_count": 0,
                "last_failed_at": _now(),
                "locked_until": None,
            },
        )

        # Reset a stale count (older than the attempt window).
        if not created and attempt.last_failed_at is not None:
            window_start = _now() - timedelta(hours=_window_hours())
            if attempt.last_failed_at < window_start:
                attempt.failed_count = 0

        attempt.failed_count = (attempt.failed_count or 0) + 1
        attempt.last_failed_at = _now()

        cooldown_after = _cooldown_after()
        restrict_after = _restrict_after()

        if attempt.failed_count >= restrict_after:
            # 7th (or more) failure: restriction.
            attempt.locked_until = _now() + timedelta(seconds=_restrict_seconds())
            attempt.save()
            logger.warning(
                "Login restricted for %s after %d failed attempts",
                email,
                attempt.failed_count,
            )
            return FailureResult(
                locked=True,
                kind="restricted",
                retry_after=_restrict_seconds(),
            )

        if attempt.failed_count == cooldown_after:
            # 5th failure: cooldown.
            attempt.locked_until = _now() + timedelta(seconds=_cooldown_seconds())
            attempt.save()
            logger.warning(
                "Login cooldown for %s after %d failed attempts",
                email,
                attempt.failed_count,
            )
            return FailureResult(
                locked=True,
                kind="cooldown",
                retry_after=_cooldown_seconds(),
            )

        # Not yet at a penalty threshold: report attempts left.
        remaining_before_cooldown = max(0, cooldown_after - attempt.failed_count)
        if attempt.failed_count < cooldown_after:
            # 1-4 failures.
            next_penalty = "cooldown"
            attempts_left = remaining_before_cooldown
        elif attempt.failed_count == cooldown_after + 1:
            # 6th failure (right after cooldown): 1 attempt left before restriction.
            next_penalty = "restriction"
            attempts_left = 1
        else:
            # After a cooldown, failed_count == 5: 2 attempts left before restriction.
            next_penalty = "restriction"
            attempts_left = max(0, restrict_after - attempt.failed_count)

        attempt.save()
        return FailureResult(
            locked=False,
            attempts_left=attempts_left,
            next_penalty=next_penalty,
        )


def reset(email: str) -> None:
    """Clear the failed-attempt record for the email (used on success / password reset)."""
    email = _normalize_email(email)
    LoginAttempt.objects.filter(email=email).delete()
    logger.info("Login attempt record cleared for %s", email)
