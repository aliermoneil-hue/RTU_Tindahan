"""Six-digit email verification codes.

The frontend signs a student up in three steps: details, code, done. The code
is issued here, emailed by `emails.send_verification_code_email`, and checked
by `check_code`. Rules:

    CODE_TTL_MINUTES   the code dies after 5 minutes
    MAX_ATTEMPTS       5 wrong tries and the code is burned
    RESEND_SECONDS     wait 30 seconds between requests

Only a hash of the code is stored, so a leaked database row cannot be used to
verify an account. The plain code exists only long enough to be emailed.
"""

import secrets
from datetime import timedelta

from django.contrib.auth.hashers import check_password, make_password
from django.core.cache import cache
from django.utils import timezone

from .models import VerificationCode

CODE_TTL_MINUTES = 5
MAX_ATTEMPTS = 5
RESEND_SECONDS = 30

COOLDOWN_KEY = "verify-code-cooldown:{email}"


class CodeError(Exception):
    """A reason a code cannot be issued or accepted. Safe to show the user."""

    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message = message
        self.status = status


def generate_code() -> str:
    """A uniformly random 6-digit code, leading zeros included."""
    return f"{secrets.randbelow(1_000_000):06d}"


def start_cooldown(email: str) -> bool:
    """True when a new code may be requested now; also starts the wait."""
    return cache.add(COOLDOWN_KEY.format(email=email.lower()), True, RESEND_SECONDS)


def cooldown_active(email: str) -> bool:
    return cache.get(COOLDOWN_KEY.format(email=email.lower())) is not None


def issue_code(user) -> str:
    """Create (or replace) the account's code and return the plain text."""
    code = generate_code()
    VerificationCode.objects.update_or_create(
        user=user,
        defaults={
            "code_hash": make_password(code),
            "expires_at": timezone.now() + timedelta(minutes=CODE_TTL_MINUTES),
            "attempts": 0,
        },
    )
    cache.set(COOLDOWN_KEY.format(email=user.email.lower()), True, RESEND_SECONDS)
    return code


def clear_code(user) -> None:
    VerificationCode.objects.filter(user=user).delete()


def check_code(user, submitted: str) -> None:
    """Raise CodeError unless `submitted` is the live code for this account."""
    try:
        record = user.verification_code
    except VerificationCode.DoesNotExist:
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

