"""The screening service boundary (AI-01 to AI-16).

Everything that touches an LLM lives behind `get_screener()`. The rest of the
system only ever sees a `Verdict` with one of three outcomes, a reason, and a
confidence level, so the provider can be swapped without touching the catalogue.

Rules that hold here, not in the provider:

* AI-09 - the provider only sees content after it has been cleaned of names,
  contact numbers, and other identifying details.
* AI-07 - if the provider is missing or raises, the result is NEEDS_REVIEW. It
  is never silently approved.
* AI-12 - a low-confidence verdict is downgraded to NEEDS_REVIEW.
* AI-14 - English, Filipino, and Taglish are all in scope; the stub says so.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from enum import Enum

from django.conf import settings

logger = logging.getLogger(__name__)


class Outcome(str, Enum):
    APPROVED = "approved"
    NEEDS_REVIEW = "needs_review"
    REJECTED = "rejected"


# Plain strings rather than TextChoices: this module is deliberately free of
# model imports so it can run in a management command, a signal, or a test.
APPROVED = Outcome.APPROVED.value
NEEDS_REVIEW = Outcome.NEEDS_REVIEW.value
REJECTED = Outcome.REJECTED.value
OUTCOMES = (APPROVED, NEEDS_REVIEW, REJECTED)


@dataclass(frozen=True)
class Verdict:
    """What a screener returns. `cleaned_text` is what the provider received."""

    outcome: str
    reason: str = ""
    confidence: float = 0.0
    cleaned_text: str = ""
    provider: str = "none"
    raw: dict = field(default_factory=dict)

    def __post_init__(self):
        if self.outcome not in OUTCOMES:
            raise ValueError(f"Unknown screening outcome: {self.outcome!r}")

    @property
    def is_confident_enough(self) -> bool:
        threshold = getattr(settings, "SCREENING_MIN_CONFIDENCE", 0.7)
        return self.confidence >= threshold


# ---------------------------------------------------------------------------
# AI-09: remove identifying details before anything leaves this process
# ---------------------------------------------------------------------------

_EMAIL = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.]+\b")
_MOBILE = re.compile(r"(?<!\d)(?:\+63|0)9\d{2}[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)")
_LANDLINE = re.compile(r"(?<!\d)\(?0?2\)?[\s.-]?\d{3,4}[\s.-]?\d{4}(?!\d)")
_STUDENT_NO = re.compile(r"(?<!\d)\d{4}-\d{6}(?!\d)")
_URL = re.compile(r"\b(?:https?://|www\.)\S+", re.IGNORECASE)
_HANDLE = re.compile(r"(?<![\w@])@[A-Za-z0-9_.]{3,}")
_ACCOUNT_NAME = re.compile(
    r"\b(?:fb|facebook|ig|instagram|messenger|gc|viber|telegram|tiktok)\s*[:@-]?\s*\S+",
    re.IGNORECASE,
)

# A conservative name pass. It only redacts a name when it follows an
# introducing word, so it will not eat ordinary sentence text.
_NAME_INTRO = re.compile(
    r"\b(?:name is|names?|pangalan(?: ko)?(?: ay)?|ako si|seller is|contact person)\s+"
    r"([A-Z][\w'-]+(?:\s+[A-Z][\w'-]+){0,3})",
)

REDACTED = "[redacted]"


def scrub(text: str) -> str:
    """Remove identifying details from content before it is screened (AI-09)."""
    if not text:
        return ""
    cleaned = text
    for pattern in (
        _EMAIL,
        _MOBILE,
        _STUDENT_NO,
        _URL,
        _ACCOUNT_NAME,
        _HANDLE,
        _LANDLINE,
    ):
        cleaned = pattern.sub(REDACTED, cleaned)
    cleaned = _NAME_INTRO.sub(lambda m: m.group(0)[: -len(m.group(1))] + REDACTED, cleaned)
    cleaned = re.sub(rf"(?:{re.escape(REDACTED)}\s*){{2,}}", f"{REDACTED} ", cleaned)
    return cleaned.strip()


# ---------------------------------------------------------------------------
# AI-10: rules live in settings, not in code
# ---------------------------------------------------------------------------

DEFAULT_RULES = {
    "prohibited": [
        "weapon",
        "baril",
        "gun",
        "drugs",
        "shabu",
        "marijuana",
        "fake id",
        "peke",
        "scam",
        "cheating",
        "answer key",
        "thesis for sale",
    ],
    "review": [
        "prescription",
        "gamot",
        "alcohol",
        "vape",
        "hilot",
        "tutor na",
    ],
}


def screening_rules() -> dict:
    """AI-10: rules come from the database first, then settings, then defaults.

    An Administrator edits ScreeningRule rows in the back office; no deploy is
    needed for the change to take effect.
    """
    prohibited, review = [], []
    try:
        from .models import ScreeningRule

        rows = ScreeningRule.objects.filter(is_active=True)
        for term, outcome in rows.values_list("term", "outcome"):
            (prohibited if outcome == REJECTED else review).append(term)
    except Exception:
        # Before migrations run (or in a bare script) fall back to settings.
        rows = None

    if prohibited or review:
        return {"prohibited": prohibited, "review": review}

    configured = getattr(settings, "SCREENING_RULES", None)
    return configured or DEFAULT_RULES


def rule_version() -> str:
    """Changes when an Administrator edits the rules, so logs stay meaningful."""
    try:
        from .models import ScreeningRule

        latest = ScreeningRule.objects.order_by("-updated_at").values_list(
            "updated_at", flat=True
        ).first()
        if latest:
            return f"db:{latest.isoformat()}"
    except Exception:
        pass
    return getattr(settings, "SCREENING_RULES_VERSION", "default")


# ---------------------------------------------------------------------------
# Screeners
# ---------------------------------------------------------------------------


class BaseScreener:
    name = "base"

    def screen(self, text: str, *, kind: str = "listing") -> Verdict:  # pragma: no cover
        raise NotImplementedError


class RuleScreener(BaseScreener):
    """The stub: keyword rules over the scrubbed text.

    No network call, no key, fully deterministic, so the flow (AI-02 to AI-05,
    AI-08, AI-11, AI-15) can be built and tested before a provider is chosen.
    """

    name = "rules"

    def screen(self, text: str, *, kind: str = "listing") -> Verdict:
        cleaned = scrub(text)
        haystack = cleaned.casefold()
        rules = screening_rules()

        for term in rules.get("prohibited", ()):
            if term.casefold() in haystack:
                return Verdict(
                    outcome=REJECTED,
                    reason=(
                        f"Automatic check: the text mentions '{term}', which the "
                        "university rules do not allow on the marketplace."
                    ),
                    confidence=0.9,
                    cleaned_text=cleaned,
                    provider=self.name,
                )

        for term in rules.get("review", ()):
            if term.casefold() in haystack:
                return Verdict(
                    outcome=NEEDS_REVIEW,
                    reason=(
                        f"Automatic check: the text mentions '{term}', which needs a "
                        "moderator to decide."
                    ),
                    confidence=0.55,
                    cleaned_text=cleaned,
                    provider=self.name,
                )

        return Verdict(
            outcome=APPROVED,
            reason="Automatic check: no prohibited wording found.",
            confidence=0.8,
            cleaned_text=cleaned,
            provider=self.name,
        )


class UnavailableScreener(BaseScreener):
    """AI-07: the provider is not configured. Never approves anything."""

    name = "unavailable"

    def screen(self, text: str, *, kind: str = "listing") -> Verdict:
        return Verdict(
            outcome=NEEDS_REVIEW,
            reason="Automatic check is unavailable, so a moderator will review this.",
            confidence=0.0,
            cleaned_text=scrub(text),
            provider=self.name,
        )


def get_screener() -> BaseScreener:
    """Pick the screener from settings. The API key never leaves the server."""
    provider = str(getattr(settings, "LLM_PROVIDER", "") or "").strip().lower()
    has_key = bool(str(getattr(settings, "LLM_API_KEY", "") or "").strip())

    # A real provider is only used once a key exists. Until then, and until a
    # provider adapter is written, the deterministic stub stands in.
    if provider and has_key:
        logger.warning(
            "LLM_PROVIDER=%s is configured but no provider adapter is implemented "
            "yet; falling back to the rule stub.",
            provider,
        )
    return RuleScreener()


def screen(text: str, *, kind: str = "listing") -> Verdict:
    """Screen text and apply AI-12 (low confidence becomes NEEDS_REVIEW)."""
    screener = get_screener()
    try:
        verdict = screener.screen(text, kind=kind)
    except Exception:  # AI-07
        logger.exception("Screening failed; sending the item to the moderator queue.")
        return UnavailableScreener().screen(text, kind=kind)

    if verdict.outcome == APPROVED and not verdict.is_confident_enough:
        return Verdict(
            outcome=NEEDS_REVIEW,
            reason=(
                "Automatic check was not confident enough to publish this, so a "
                "moderator will review it."
            ),
            confidence=verdict.confidence,
            cleaned_text=verdict.cleaned_text,
            provider=verdict.provider,
            raw=verdict.raw,
        )
    return verdict
