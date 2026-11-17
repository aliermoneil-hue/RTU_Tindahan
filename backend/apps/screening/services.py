"""Run a screen and record the verdict.

The one rule this module enforces: screening never publishes.

A clean verdict leaves the listing waiting for a moderator, exactly as before
the service existed. A flagged verdict, or a provider that cannot be reached,
sends it to `needs_review`. Failing closed is the only safe direction when
the gate is the thing keeping prohibited content off the site.
"""

from django.db import transaction

from apps.catalog.models import Listing

from .models import ScreeningResult
from .providers import get_provider

PROVIDER_FAILED_REASON = (
    "Automatic screening could not run. A moderator must look at this listing."
)


@transaction.atomic
def run_screening(listing) -> ScreeningResult:
    """Screen one listing, store the result, and move the status if needed."""
    try:
        verdict = get_provider().screen(listing)
    except Exception as exc:  # noqa: BLE001 - any provider failure means "a human looks"
        result = ScreeningResult.objects.create(
            listing=listing,
            verdict=ScreeningResult.Verdict.FLAGGED,
            score=None,
            reasons=[PROVIDER_FAILED_REASON, f"{type(exc).__name__}: {str(exc)[:200]}"],
            provider="error",
        )
    else:
        result = ScreeningResult.objects.create(
            listing=listing,
            verdict=verdict.verdict,
            score=verdict.score,
            reasons=verdict.reasons,
            provider=verdict.provider,
            model_name=verdict.model,
            raw=verdict.raw,
        )

    if result.is_flagged and listing.status != Listing.Status.NEEDS_REVIEW:
        listing.status = Listing.Status.NEEDS_REVIEW
        listing.save(update_fields=["status", "updated_at"])

    return result
