"""Token authentication with a lifetime.

DRF's `authtoken` never expires a token: once issued, it is valid until it is
deleted, which means a token copied out of a browser profile works forever.
This class adds an age check on top, without changing the token format, so the
React app keeps sending `Authorization: Token <key>` and nothing on the client
changes.

Two limits, because a session can end in two ways:

  `AUTH_IDLE_MINUTES` (default 30)  SE-05: no request for half an hour and the
                                    session is over, however new the token is.
  `AUTH_TOKEN_TTL_DAYS` (default 14) an outer bound, so a session that is used
                                    every day still ends eventually.

Either can be set to 0 to switch that limit off. Idleness is measured from
`TokenActivity.last_seen`, which is touched at most once a minute so that a
busy screen does not write a row per request.

An expired token is refused, not deleted: the row stays as evidence until the
account signs in again or a moderator removes it. Deleting on failure would
also make a clock skew look like a stolen token.
"""

from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework.authentication import TokenAuthentication
from rest_framework.exceptions import AuthenticationFailed


def idle_limit() -> timedelta | None:
    """How long a session may sit unused. None means "no idle limit"."""
    minutes = getattr(settings, "AUTH_IDLE_MINUTES", 30)
    try:
        minutes = int(minutes or 0)
    except (TypeError, ValueError):
        minutes = 0
    return timedelta(minutes=minutes) if minutes > 0 else None


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

        # A suspended or banned account must not keep working with a token it
        # already holds. The web token is deleted on suspension, but a copy
        # taken earlier would otherwise stay valid until it expired.
        if not user.can_sign_in:
            raise AuthenticationFailed(
                "This account is suspended or banned.",
                code="account_inactive",
            )

        lifetime = token_lifetime()
        if lifetime is not None:
            age = timezone.now() - token.created
            if age > lifetime:
                raise AuthenticationFailed(
                    "Your sign-in has expired. Sign in again to continue.",
                    code="token_expired",
                )

        self._check_activity(token)

        return user, token

    def _check_activity(self, token):
        """SE-05: end a session that has not been used for `AUTH_IDLE_MINUTES`."""
        idle = idle_limit()
        if idle is None:
            return

        from .models import TokenActivity

        now = timezone.now()
        row = TokenActivity.objects.filter(token=token).first()

        if row is None:
            # A token issued before this check existed, or the first request of
            # a session: stamp it now rather than refusing a working sign-in.
            TokenActivity.objects.create(token=token, last_seen=now)
            return

        if now - row.last_seen > idle:
            minutes = int(idle.total_seconds() // 60)
            raise AuthenticationFailed(
                f"You were signed out after {minutes} minutes of no activity. "
                "Sign in again to continue.",
                code="session_idle",
            )

        # Touch at most once a minute: a screen that polls every few seconds
        # must not turn into a write per request.
        touch_after = int(getattr(settings, "AUTH_IDLE_TOUCH_SECONDS", 60) or 0)
        if touch_after <= 0 or (now - row.last_seen).total_seconds() >= touch_after:
            TokenActivity.objects.filter(pk=row.pk).update(last_seen=now)
