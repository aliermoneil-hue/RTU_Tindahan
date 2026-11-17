"""Screening providers: the only place a language model is ever called from.

Boundary rules, and the reason this file is short and boring:

- The provider is chosen by `LLM_PROVIDER` in `backend/.env`, read through
  Django settings. No request data can change which provider is used.
- The key is `LLM_API_KEY`, also server-side. It travels in a request header,
  never in the URL, never in a response, and never in an error message that
  reaches the browser. The client receives a verdict, not a credential.
- A provider answers one question about one listing and returns a `Verdict`.
  Everything else — storing it, moving the listing's status, falling back —
  belongs to `apps.screening.services`.

Two providers ship:

  stub    Deterministic rules. No account, no key, no network. The default.
  gemini  Google Gemini. The model is named in `LLM_MODEL`, never in code,
          because model names are retired without notice: the first name tried
          for this project answered "no longer available to new users" and
          pointed at a successor that then returned 503s. `gemini-3.1-flash-lite`
          is the one measured to work (1-2 s per listing).
"""

import json
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from urllib.error import URLError
from urllib.request import Request, urlopen

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

DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite"
GEMINI_ENDPOINT = (
    "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
)

# The instruction and the schema do the real work of keeping a model's answer
# usable: a verdict, a score, and at most three short reasons. No free-form
# prose is accepted, so a chatty answer cannot slip past the parser.
GEMINI_INSTRUCTION = """You screen listings for a university campus marketplace in the Philippines.
Decide whether a listing may be published. Flag anything that is: counterfeit or pirated goods,
leaked or for-sale exam answers and answer keys, weapons or ammunition, illegal drugs, vapes or
e-cigarettes, gambling or betting, alcohol, stolen goods, another person's ID or personal data,
sexual content, harassment, academic dishonesty such as doing another student's coursework, or a
scam pattern (pay-first, no meetup, contact-only).
Ordinary second-hand goods, food, uniforms, school supplies and services are clean.
Score 0-100: 0 certainly harmless, 100 certainly prohibited. 50 or above means flagged.
Give at most three short reasons, each one sentence, written for a moderator."""

GEMINI_SCHEMA = {
    "type": "object",
    "properties": {
        "verdict": {"type": "string", "enum": ["clean", "flagged"]},
        "score": {"type": "integer", "minimum": 0, "maximum": 100},
        "reasons": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["verdict", "score", "reasons"],
}


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
    """Deterministic stand-in for a real model (AI-04).

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


def post_json(url, payload, headers, timeout):
    """The single network seam, so tests can answer without a socket."""
    request = Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    with urlopen(request, timeout=timeout) as response:
        return json.load(response)


class GeminiProvider:
    """Google Gemini behind the same `screen()` contract as the stub.

    The key is read from settings and sent as the `x-goog-api-key` header. It
    is deliberately absent from the URL, which lands in logs and in error
    messages far more often than a header does.
    """

    name = "gemini"

    def __init__(self, api_key=None, model=None, timeout=None, transport=None):
        self.api_key = (
            getattr(settings, "SCREENING_API_KEY", "") if api_key is None else api_key
        )
        self.model = model or getattr(settings, "SCREENING_MODEL", DEFAULT_GEMINI_MODEL)
        self.timeout = (
            getattr(settings, "SCREENING_TIMEOUT", 12.0) if timeout is None else timeout
        )
        self.transport = transport or post_json
        if not self.api_key:
            raise ImproperlyConfigured(
                "LLM_PROVIDER=gemini needs LLM_API_KEY in backend/.env. "
                "Either set it or put LLM_PROVIDER back to stub."
            )

    def _payload(self, listing) -> dict:
        return {
            "systemInstruction": {"parts": [{"text": GEMINI_INSTRUCTION}]},
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {
                            "text": (
                                f"Title: {listing.title}\n"
                                f"Description: {listing.description}\n"
                                f"Price: {listing.price}"
                            )
                        }
                    ],
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 300,
                "responseMimeType": "application/json",
                "responseSchema": GEMINI_SCHEMA,
            },
        }

    def screen(self, listing) -> Verdict:
        data = self.transport(
            GEMINI_ENDPOINT.format(model=self.model),
            self._payload(listing),
            {"x-goog-api-key": self.api_key, "Content-Type": "application/json"},
            self.timeout,
        )

        candidates = data.get("candidates") or []
        if not candidates:
            raise URLError("Gemini returned no candidates.")
        raw_text = candidates[0]["content"]["parts"][0]["text"]
        parsed = json.loads(raw_text)

        # An answer we cannot read is not a pass. Anything other than an
        # explicit "clean" is treated as flagged: the moderator queue is a
        # cheap place to be wrong, a published counterfeit is not.
        verdict = "clean" if parsed.get("verdict") == "clean" else "flagged"

        score = parsed.get("score")
        try:
            score = int(score)
        except (TypeError, ValueError):
            score = None

        reasons = [
            str(reason).strip()
            for reason in (parsed.get("reasons") or [])
            if str(reason).strip()
        ][:3]

        return Verdict(
            verdict=verdict,
            score=score,
            reasons=reasons,
            provider=self.name,
            model=self.model,
            raw={
                "finish": candidates[0].get("finishReason", ""),
                "tokens": (data.get("usageMetadata") or {}).get("totalTokenCount"),
            },
        )


PROVIDERS = {
    "stub": StubProvider,
    "gemini": GeminiProvider,
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
