"""Six-digit email codes: the sign-up code (AV-03) and the reset code (AV-06).

The frontend signs a student up in three steps: details, code, done. The same
machinery serves a forgotten password, with its own model and its own clocks.
Rules:

    CODE_TTL_MINUTES     the sign-up code dies after 5 minutes
    RESET_TTL_MINUTES    the reset code lives 15 minutes (it is read later)
    MAX_ATTEMPTS         5 wrong tries and the code is burned
    RESEND_SECONDS       wait 30 seconds before asking for another

Only a hash of the code is stored, so a leaked database row cannot be used to
verify an account or take one over. The plain code exists only long enough to
be emailed.

Every function takes `model`, so a caller chooses which flow it is driving.
The defaults keep the sign-up call sites unchanged.
"""

import secrets
from datetime import timedelta

from django.contrib.auth.hashers import check_password, make_password
from django.core.cache import cache
from django.utils import timezone

from .models import PasswordResetCode, VerificationCode

CODE_TTL_MINUTES = 5
RESET_TTL_MINUTES = 15
MAX_ATTEMPTS = 5
RESEND_SECONDS = 30
RESET_RESEND_SECONDS = 60

COOLDOWN_KEY = "verify-code-cooldown:{email}"
RESET_COOLDOWN_KEY = "password-reset-cooldown:{email}"


class CodeError(Exception):
    """A reason a code cannot be issued or accepted. Safe to show the user."""

    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message = message
        self.status = status


def generate_code() -> str:
    """A uniformly random 6-digit code, leading zeros included."""
    return f"{secrets.randbelow(1_000_000):06d}"


def start_cooldown(email: str, *, key: str = COOLDOWN_KEY, seconds: int = RESEND_SECONDS) -> bool:
    """True when a new code may be requested now; also starts the wait."""
    return cache.add(key.format(email=email.lower()), True, seconds)


def cooldown_active(email: str, *, key: str = COOLDOWN_KEY) -> bool:
    return cache.get(key.format(email=email.lower())) is not None


def issue_code(
    user,
    *,
    model=VerificationCode,
    ttl_minutes: int = CODE_TTL_MINUTES,
    cooldown_key: str = COOLDOWN_KEY,
    cooldown_seconds: int = RESEND_SECONDS,
) -> str:
    """Create (or replace) the account's code and return the plain text."""
    code = generate_code()
    model.objects.update_or_create(
        user=user,
        defaults={
            "code_hash": make_password(code),
            "expires_at": timezone.now() + timedelta(minutes=ttl_minutes),
            "attempts": 0,
        },
    )
    cache.set(cooldown_key.format(email=user.email.lower()), True, cooldown_seconds)
    return code


def clear_code(user, *, model=VerificationCode) -> None:
    model.objects.filter(user=user).delete()


def check_code(user, submitted: str, *, model=VerificationCode) -> None:
    """Raise CodeError unless `submitted` is the live code for this account."""
    try:
        record = model.objects.get(user=user)
    except model.DoesNotExist:
        raise CodeError("That code is not right. Ask for a new code.") from None

    if timezone.now() > record.expires_at:
        record.delete()
        raise CodeError("That code has expired. Ask for a new code.")

    if record.attempts >= MAX_ATTEMPTS:
        record.delete()
        raise CodeError("Too many wrong tries. Ask for a new code.")

    if not check_password(submitted, record.code_hash):
        record.attempts += 1
        record.save(update_fields=["attempts"])
        left = MAX_ATTEMPTS - record.attempts
        if left <= 0:
            record.delete()
            raise CodeError("Too many wrong tries. Ask for a new code.")
        raise CodeError(
            f"That code is not right. {left} {'try' if left == 1 else 'tries'} left."
        )

    record.delete()


# ---------------------------------------------------------------------------
# Password reset (AV-06)
# ---------------------------------------------------------------------------


def issue_reset_code(user) -> str:
    return issue_code(
        user,
        model=PasswordResetCode,
        ttl_minutes=RESET_TTL_MINUTES,
        cooldown_key=RESET_COOLDOWN_KEY,
        cooldown_seconds=RESET_RESEND_SECONDS,
    )


def check_reset_code(user, submitted: str) -> None:
    check_code(user, submitted, model=PasswordResetCode)


def clear_reset_code(user) -> None:
    clear_code(user, model=PasswordResetCode)


def reset_cooldown_active(email: str) -> bool:
    return cooldown_active(email, key=RESET_COOLDOWN_KEY)


def start_reset_cooldown(email: str) -> bool:
    return start_cooldown(
        email, key=RESET_COOLDOWN_KEY, seconds=RESET_RESEND_SECONDS
    )
