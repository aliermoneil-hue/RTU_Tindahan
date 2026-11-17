"""Wiring the screening verdict into the catalogue.

`screen_and_apply` is the only function other apps should call. It screens,
writes the AI-08 log, and moves the listing's status per AI-02 to AI-05:

    approved      -> published (status=approved, published_at set)
    needs_review  -> held in the moderator queue
    rejected      -> rejected, with the reason shown to the seller (AI-05)

Every rejected or review item is also queued for a moderator (AI-04, AI-11),
because the AI is never the final authority.
"""

from __future__ import annotations

import logging

from django.utils import timezone

from .models import ScreeningLog
from .services import (
    APPROVED,
    NEEDS_REVIEW,
    REJECTED,
    rule_version,
    screen,
)

logger = logging.getLogger(__name__)

LISTING_STATUS = {
    APPROVED: "approved",
    NEEDS_REVIEW: "needs_review",
    REJECTED: "rejected",
}


def listing_text(listing) -> str:
    """The text AI-01 sends for screening: title plus description."""
    return f"{listing.title}\n\n{listing.description}".strip()


def screen_and_apply(listing, *, commit=True):
    """Screen a listing, log the result, and set its status.

    Passing commit=False leaves the caller's own save() as the only write,
    which keeps the create path inside one transaction.
    """
    verdict = screen(listing_text(listing), kind="listing")

    log = ScreeningLog.objects.create(
        content_type=ScreeningLog.ContentType.LISTING,
        object_id=listing.pk,
        cleaned_text=verdict.cleaned_text,
        outcome=verdict.outcome,
        reason=verdict.reason,
        confidence=verdict.confidence,
        provider=verdict.provider,
        rules_version=rule_version(),
    )

    listing.status = LISTING_STATUS[verdict.outcome]
    listing.rejection_reason = verdict.reason if verdict.outcome == REJECTED else ""
    if verdict.outcome == APPROVED and listing.published_at is None:
        listing.published_at = timezone.now()

    if commit:
        listing.save(
            update_fields=["status", "rejection_reason", "published_at", "updated_at"]
        )

    logger.info(
        "Screened listing %s: %s (confidence %.2f, provider=%s)",
        listing.pk,
        verdict.outcome,
        verdict.confidence,
        verdict.provider,
    )
    return verdict, log


def rescreen_listing(listing):
    """AI-01 wants edits screened again, so an edit sends the listing back.

    An approved listing that is edited drops to pending and is re-screened.
    """
    listing.published_at = None
    return screen_and_apply(listing)
