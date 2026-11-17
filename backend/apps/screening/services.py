"""Run a screen and record the verdict.

The one rule this module enforces: screening never publishes.

A clean verdict leaves the listing waiting for a moderator, exactly as before
the service existed. A flagged verdict sends it to `needs_review`.

When the configured provider fails — a timeout, an exhausted quota, a retired
model name — there are two honest answers, and `LLM_FALLBACK` picks one:

  true (default)   the deterministic rules provider answers instead, and the
                   audit row says so. A listing still gets screened, and a
                   human still approves it, so the gate is never open. This is
                   what keeps a demo alive when a free tier runs dry mid-flow.
  false            the listing goes to `needs_review` unscreened, with the
                   provider error recorded as the reason.

Neither answer publishes anything, which is why falling back is safe here and
would not be safe in a system that auto-approved clean verdicts.
"""

from django.conf import settings
from django.db import transaction

from apps.catalog.models import Listing

from .models import ScreeningResult
from .providers import StubProvider, get_provider

PROVIDER_FAILED_REASON = (
    "Automatic screening could not run. A moderator must look at this listing."
)
FALLBACK_REASON = (
    "The {provider} provider failed ({error}), so the rules check answered."
)


def _store(listing, *, verdict, score, reasons, provider, model="", raw=None):
    return ScreeningResult.objects.create(
        listing=listing,
        verdict=verdict,
        score=score,
        reasons=reasons,
        provider=provider,
        model_name=model,
        raw=raw or {},
    )


@transaction.atomic
def run_screening(listing) -> ScreeningResult:
    """Screen one listing, store the result, and move the status if needed."""
    configured = (getattr(settings, "SCREENING_PROVIDER", "stub") or "stub").lower()

    try:
        verdict = get_provider().screen(listing)
    except Exception as exc:  # noqa: BLE001 - any provider failure lands here
        error = type(exc).__name__
        if getattr(settings, "SCREENING_FALLBACK", True):
            fallback = StubProvider().screen(listing)
            result = _store(
                listing,
                verdict=fallback.verdict,
                score=fallback.score,
                reasons=[FALLBACK_REASON.format(provider=configured, error=error)]
                + fallback.reasons,
                provider=f"{configured}+fallback",
                model=fallback.model,
                raw={"provider_error": error, **fallback.raw},
            )
        else:
            result = _store(
                listing,
                verdict=ScreeningResult.Verdict.FLAGGED,
                score=None,
                reasons=[
                    PROVIDER_FAILED_REASON,
                    f"{error}: {str(exc)[:200]}",
                ],
                provider="error",
                raw={"provider_error": error},
            )
    else:
        result = _store(
            listing,
            verdict=verdict.verdict,
            score=verdict.score,
            reasons=verdict.reasons,
            provider=verdict.provider,
            model=verdict.model,
            raw=verdict.raw,
        )

    if result.is_flagged and listing.status != Listing.Status.NEEDS_REVIEW:
        listing.status = Listing.Status.NEEDS_REVIEW
        listing.save(update_fields=["status", "updated_at"])

    return result
