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
          then worked for months before becoming intermittent (503 on some
          calls, 1 s on others), which the fallback hides as a stall.
          `gemini-3.5-flash-lite` is the one measured on 2026-11-24: four of
          four sample items correct in 0.9-1.3 s.
"""

import json
import re
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from urllib.error import URLError
from urllib.request import Request, urlopen

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

# The "Cannot sell" list from RTU_Tindahan_Posting_and_Selling_Guideline.pdf
# (Section 1), as words a listing might actually contain. Deliberately short
# and specific: a long list of vague words produces false flags, and a
# moderator who learns to ignore the queue is worse than no queue.
PROHIBITED_TERMS = (
    # Counterfeit or pirated goods, including fake official RTU merchandise.
    "counterfeit",
    "replica",
    "pirated",
    "fake id",
    "fake rtu",
    "cracked copy",
    # Exam answers, answer keys, and help that is academic cheating.
    "answer key",
    "exam answers",
    "quiz answers",
    "leaked exam",
    "thesis for hire",
    "do my homework",
    "do my assignment",
    "take my exam",
    # Weapons and ammunition.
    "firearm",
    "ammunition",
    "handgun",
    "rifle",
    "pistol",
    "unlicensed firearm",
    # Illegal drugs.
    "shabu",
    "marijuana",
    "cocaine",
    "ecstasy pills",
    "illegal drugs",
    # Vapes, e-cigarettes and tobacco.
    "vape",
    "ecig",
    "e-cigarette",
    "tobacco",
    "nicotine",
    # Alcohol. "beer" and "wine" are left out on purpose: root beer, ginger
    # beer and cooking wine are ordinary food words, and the sample pass showed
    # them flagging clean listings. The model handles the semantic cases.
    "liquor",
    "vodka",
    "whiskey",
    # Medicines, prescription or not.
    "prescription medicine",
    "prescription drug",
    "antibiotic",
    # Gambling. Bare "casino" flags a film or a book title; the chips do not.
    "betting",
    "gambling",
    "casino chips",
    "jueteng",
    "sabong",
    # Stolen goods and another person's ID or personal details. "stolen" alone
    # flags a novel called The Stolen Heir; the phrase is what a seller of
    # stolen goods actually writes.
    "stolen goods",
    "stolen items",
    "fake student id",
    "someone else's id",
    "another person's id",
    # Sexual content and harassment.
    "porn",
    "nude photos",
    "nude pics",
    "sexual content",
)

# The guideline's scam pattern (Section 3): pay-first, no meetup, contact or
# pay outside the app. These flag even when the item itself is ordinary.
SCAM_PATTERNS = (
    "pay first",
    "payment first",
    "pay before",
    "send payment",
    "send gcash",
    "gcash first",
    "gcash number",
    "deposit first",
    "downpayment first",
    "no meetup",
    "no meet-up",
    "no meet up",
    "contact me at",
    "contact only",
    "dm me",
    "message me on facebook",
    "text me at",
    "telegram",
    "whatsapp",
    "viber",
)

# A Philippine mobile number in the text is the same off-app contact signal.
PHONE_RE = re.compile(r"(?:\+63|0)9\d{9}")

# Scores at or above this go to a human (AI-03, guideline Section 3). Below
# it, the listing still waits for approval — screening never publishes
# anything by itself (LS-05).
FLAG_THRESHOLD = 50

MIN_DESCRIPTION = 20
EXCESSIVE_PRICE = 50_000

DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite"
GEMINI_ENDPOINT = (
    "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
)

# The instruction and the schema do the real work of keeping a model's answer
# usable: a verdict, a score, and at most three short reasons. No free-form
# prose is accepted, so a chatty answer cannot slip past the parser.
GEMINI_INSTRUCTION = """You screen listings for RTU Tindahan, a university campus marketplace in the Philippines.
Decide whether a listing may be published. Flag anything that is:
- counterfeit, fake, replica or pirated goods, including fake official RTU merchandise;
- exam answers, answer keys, leaked exams, or help that is academic cheating such as doing another student's coursework;
- weapons or ammunition; illegal drugs;
- vapes, e-cigarettes, tobacco, or alcohol;
- medicines, prescription or not;
- gambling or betting items; stolen goods; another person's ID or personal details; resold event tickets without permission;
- sexual or offensive content, or harassment;
- a scam pattern: pay-first, no meetup, contact only, or payment and contact outside the app.
Also raise the score for these guideline signals: a banned word ("replica", "answer key", "vape",
"counterfeit"), a description under 20 characters, a price over 50,000 pesos, a web link in the
text, or an all-capitals title. An all-capitals title alone is a spam shape, not a violation.
Ordinary second-hand goods, food, uniforms, school supplies and services are clean.
Score 0-100: 0 certainly harmless, 100 certainly prohibited. 50 or above means flagged.
Give at most three short reasons, each one sentence, written for a moderator."""

GEMINI_POST_INSTRUCTION = """You screen forum posts for RTU Tindahan, a university campus marketplace in the Philippines.
Decide whether a post may stay on the public forum. Flag only content the posting guideline forbids:
- offers of counterfeit, fake, replica or pirated goods, including fake official RTU merchandise;
- exam answers, answer keys, leaked exams, or help that is academic cheating;
- weapons or ammunition; illegal drugs; gambling or betting;
- vapes, e-cigarettes, tobacco or alcohol offered for sale;
- medicines, prescription or not, offered for sale; stolen goods; another person's ID or personal details; resold event tickets without permission;
- sexual content, harassment, threats or hate directed at a person or group.
An ordinary conversation is clean: a question, a review, a lost-and-found notice, a shared link, a phone number,
a meetup arrangement, criticism of a class or a policy, and short replies are all allowed.
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


@dataclass
class TextSubject:
    """The words a provider is allowed to read, and nothing else.

    Listings and forum posts both arrive here, so no provider ever learns a
    Django model. `kind` decides which signals make sense: an asking price, a
    thin description, a link or "contact me at" say something about a listing
    and nothing about a conversation, so those rules are skipped for posts.
    """

    title: str
    description: str
    price: str | None = None
    kind: str = "listing"

    @classmethod
    def for_listing(cls, listing):
        return cls(
            title=listing.title or "",
            description=listing.description or "",
            price="" if listing.price is None else str(listing.price),
            kind="listing",
        )

    @classmethod
    def for_post(cls, post):
        return cls(
            title=post.title or "",
            description=post.body or "",
            price=None,
            kind="post",
        )

    @classmethod
    def for_comment(cls, comment):
        return cls(
            title="",
            description=comment.text or "",
            price=None,
            kind="comment",
        )


def as_subject(item) -> TextSubject:
    """Accept a `TextSubject`, or a listing/post model for convenience.

    The service always passes a `TextSubject`; this exists so a test or a
    shell session can hand the provider the object it just created.
    """
    if isinstance(item, TextSubject):
        return item
    if hasattr(item, "description"):
        return TextSubject.for_listing(item)
    return TextSubject.for_post(item)


def _mentions(text: str, term: str) -> bool:
    """Match a term the way a person reading the listing would.

    Phrases are matched as they are written. A single word is matched from its
    left boundary only, so "vape" catches "vapes" and "beer" catches "beers"
    while "wine" does not fire inside "twine".
    """
    if " " in term or "-" in term or "'" in term:
        return term in text
    return re.search(rf"\b{re.escape(term)}", text) is not None


class StubProvider:
    """Deterministic stand-in for a real model (AI-04).

    It reads the same fields a model would: the title, the description, and
    the asking price. Each rule that fires adds a reason and raises the score;
    the highest score wins, so one serious hit is enough to flag.

    A forum post is judged by the prohibited-content rules only. A
    conversation legitimately carries links, phone numbers, "message me on
    Facebook" and one-line replies; flagging those would bury the moderator
    queue in noise, and a queue nobody reads is worse than no queue.
    """

    name = "stub"
    model_name = "rules-v1"

    def screen(self, item) -> Verdict:
        subject = as_subject(item)
        is_listing = subject.kind == "listing"
        text = f"{subject.title} {subject.description}".lower()
        reasons: list[str] = []
        score = 0

        # The price may arrive as a Decimal (from a database row) or as the
        # string a caller assigned before saving, so normalise before comparing.
        price = None
        if is_listing and subject.price not in (None, ""):
            try:
                price = Decimal(str(subject.price))
            except (InvalidOperation, ValueError):
                price = None

        hits = [term for term in PROHIBITED_TERMS if _mentions(text, term)]
        if hits:
            reasons.append("Mentions a prohibited item: " + ", ".join(sorted(hits)) + ".")
            score = max(score, 90)

        if is_listing and len(subject.description.strip()) < MIN_DESCRIPTION:
            reasons.append("The description is too short to judge whether the item is allowed.")
            score = max(score, 55)

        if price is not None and price > EXCESSIVE_PRICE:
            reasons.append(
                f"The asking price {price} is far above a campus resale."
            )
            score = max(score, 55)

        if is_listing:
            title = subject.title
            if title.isupper() and len(title) > 12:
                # A spam shape, not a violation: on its own this stays below the
                # flag threshold, as the guideline says.
                reasons.append("The title is all capitals, a common spam pattern.")
                score = max(score, 40)

            if "http://" in text or "https://" in text or "www." in text:
                reasons.append("The text contains a link, which listings must not have.")
                score = max(score, 60)

            scams = [term for term in SCAM_PATTERNS if _mentions(text, term)]
            if PHONE_RE.search(text):
                scams.append("a phone number")
            if scams:
                reasons.append(
                    "Looks like a pay-first or off-app contact pattern: "
                    + ", ".join(sorted(set(scams)))
                    + "."
                )
                score = max(score, 85)

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

    def _payload(self, subject) -> dict:
        instruction = (
            GEMINI_INSTRUCTION
            if subject.kind == "listing"
            else GEMINI_POST_INSTRUCTION
        )
        text = f"Title: {subject.title}\nText: {subject.description}"
        if subject.kind == "comment":
            text = subject.description
        if subject.kind == "listing":
            text = (
                f"Title: {subject.title}\n"
                f"Description: {subject.description}\n"
                f"Price: {subject.price}"
            )
        return {
            "systemInstruction": {"parts": [{"text": instruction}]},
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": text}],
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 300,
                "responseMimeType": "application/json",
                "responseSchema": GEMINI_SCHEMA,
            },
        }

    def screen(self, item) -> Verdict:
        subject = as_subject(item)
        data = self.transport(
            GEMINI_ENDPOINT.format(model=self.model),
            self._payload(subject),
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
