"""Token authentication with a lifetime.

DRF's `authtoken` never expires a token: once issued, it is valid until it is
deleted, which means a token copied out of a browser profile works forever.
This class adds an age check on top, without changing the token format, so the
React app keeps sending `Authorization: Token <key>` and nothing on the client
changes.

`AUTH_TOKEN_TTL_DAYS` in `backend/.env` sets the lifetime. Zero (or empty)
disables the check and restores the old behaviour, which is what a team that
has not migrated yet should set.

An expired token is refused, not deleted: the row stays as evidence until the
account signs in again or a moderator removes it. Deleting on failure would
also make a clock skew look like a stolen token.
"""

from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework.authentication import TokenAuthentication
from rest_framework.exceptions import AuthenticationFailed


def token_lifetime() -> timedelta | None:
    days = getattr(settings, "AUTH_TOKEN_TTL_DAYS", 0)
    try:
        days = int(days or 0)
    except (TypeError, ValueError):
        days = 0
    return timedelta(days=days) if days > 0 else None


class ExpiringTokenAuthentication(TokenAuthentication):
    """Reject a token older than `AUTH_TOKEN_TTL_DAYS`."""

    def authenticate_credentials(self, key):
        user, token = super().authenticate_credentials(key)

        lifetime = token_lifetime()
        if lifetime is not None:
            age = timezone.now() - token.created
            if age > lifetime:
                raise AuthenticationFailed(
                    "Your sign-in has expired. Sign in again to continue.",
                    code="token_expired",
                )

        return user, token
