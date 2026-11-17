"""Screening providers: the only place a language model is ever called from.

Boundary rules, and the reason this file is short and boring:

- The provider is chosen by `LLM_PROVIDER` in `backend/.env`, read through
  Django settings. No request data can change which provider is used.
- The key is `LLM_API_KEY`, also server-side. It is never serialised, never
  returned in an error message, and never sent to the browser. The client
  receives a verdict, not a credential.
- A provider answers one question about one listing and returns a `Verdict`.
  Everything else — storing it, moving the listing's status — belongs to
  `apps.screening.services`.

`StubProvider` is deterministic on purpose. Until the team picks a real
provider, the same listing must always produce the same verdict, or the
moderation tests become a coin toss.
"""

from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

# Terms that a campus marketplace must never publish (AI-02). Deliberately
# short and specific: a long list of vague words produces false flags, and a
# moderator who learns to ignore the queue is worse than no queue.
PROHIBITED_TERMS = (
    "counterfeit",
    "fake id",
    "replica",
    "pirated",
    "cracked copy",
    "answer key",
    "exam answers",
    "leaked exam",
    "shabu",
    "marijuana",
    "cocaine",
    "vape",
    "ecig",
    "unlicensed firearm",
    "ammunition",
    "betting",
    "jueteng",
)

# Scores at or above this go to a human (AI-03). Below it, the listing still
# waits for approval — screening never publishes anything by itself (LS-05).
FLAG_THRESHOLD = 50

MIN_DESCRIPTION = 20
EXCESSIVE_PRICE = 50_000


@dataclass
class Verdict:
    """What a provider answers. No listing objects, no database, no side effects."""

    verdict: str
    score: int | None
    reasons: list[str] = field(default_factory=list)
    provider: str = "stub"
    model: str = ""
    raw: dict = field(default_factory=dict)


class StubProvider:
    """Deterministic stand-in for the real model (AI-04).

    It reads the same fields a model would: the title, the description, and
    the asking price. Each rule that fires adds a reason and raises the score;
    the highest score wins, so one serious hit is enough to flag.
    """

    name = "stub"
    model_name = "rules-v1"

    def screen(self, listing) -> Verdict:
        text = f"{listing.title} {listing.description}".lower()
        reasons: list[str] = []
        score = 0

        # The price may arrive as a Decimal (from a database row) or as the
        # string a caller assigned before saving, so normalise before comparing.
        try:
            price = Decimal(str(listing.price)) if listing.price is not None else None
        except (InvalidOperation, ValueError):
            price = None

        hits = [term for term in PROHIBITED_TERMS if term in text]
        if hits:
            reasons.append("Mentions a prohibited item: " + ", ".join(sorted(hits)) + ".")
            score = max(score, 90)

        if len((listing.description or "").strip()) < MIN_DESCRIPTION:
            reasons.append("The description is too short to judge whether the item is allowed.")
            score = max(score, 55)

        if price is not None and price > EXCESSIVE_PRICE:
            reasons.append(
                f"The asking price {price} is far above a campus resale."
            )
            score = max(score, 55)

        title = listing.title or ""
        if title.isupper() and len(title) > 12:
            reasons.append("The title is all capitals, a common spam pattern.")
            score = max(score, 40)

        if text.count("http") or text.count("www."):
            reasons.append("The text contains a link, which listings must not have.")
            score = max(score, 60)

        return Verdict(
            verdict="flagged" if score >= FLAG_THRESHOLD else "clean",
            score=score,
            reasons=reasons,
            provider=self.name,
            model=self.model_name,
            raw={"rules_fired": len(reasons)},
        )


PROVIDERS = {
    "stub": StubProvider,
}


def get_provider():
    """Return the configured provider, or refuse loudly.

    An unknown name is a configuration mistake, not a reason to publish
    unscreened content silently, so it raises.
    """
    name = (getattr(settings, "SCREENING_PROVIDER", "stub") or "stub").lower()
    try:
        return PROVIDERS[name]()
    except KeyError:
        raise ImproperlyConfigured(
            f"Unknown LLM_PROVIDER {name!r}. Available: {', '.join(sorted(PROVIDERS))}. "
            "Add the provider to apps/screening/providers.py before naming it in .env."
        )
