"""Search keywords read off a photograph (an extension to BD-01).

BD-01's search reads a listing's title and description. Sellers do not write
what a buyer searches for. A stool is listed as "Upuan" and the fact that it is
blue and orange exists only in the picture; ask the marketplace for "blue" and
it answers nothing, correctly, because no row contains the word.

So the same vision call that already screens a picture (AI-01) is asked a second
question about it: *what is this, in the words a buyer would type?* The answer is
stored on the listing and joined to the text search, which keeps every search
instant, offline and free — the model is asked once per photo, not once per
keystroke.

Three rules shape it:

  **It never invents.** A brand or model number the picture does not show is a
  wrong keyword, and a wrong keyword returns wrong listings that look like a
  search bug. The instruction and the schema both forbid guessing, and empty
  answers are legal.

  **It says nothing about condition.** "Brand new", "original", "authentic" are
  claims about trust, not pixels. The seller's own condition field says what the
  university lets them say.

  **It fails silent.** No key, no provider, a timeout, an unreadable answer —
  every one of them returns "" and the listing is indexed on its text alone. A
  search aid must never be the reason a listing cannot be posted.
"""

import base64
import json

from django.conf import settings

from .images import _downscaled
from .providers import GEMINI_ENDPOINT, post_json

# Enough words to be useful, few enough that the column stays a phrase rather
# than a paragraph of adjectives.
MAX_WORDS = 12
MAX_WORD_LENGTH = 30
MAX_TEXT_LENGTH = 300

# One required string and one required array, and nothing that may be empty.
# A schema with optional empty-string fields invites the model to *fill* them:
# measured on a bench photo, "brand": "" and "model": "" came back as a 300-word
# sentinel (`_none_value_not_found_12345…`) that ran to MAX_TOKENS and carried the
# real answer off with it. An array of words has nowhere to hide that.
KEYWORDS_SCHEMA = {
    "type": "object",
    "properties": {
        "subject": {"type": "string"},
        "keywords": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["subject", "keywords"],
}

KEYWORDS_INSTRUCTION = """You are labelling a photograph published on an RTU campus
marketplace listing, so that buyers can find it by searching.

Answer with one JSON object and nothing else — no explanation, no markdown.

  subject:  the plain noun for the object, lowercase, no plural, no marketing
            words — "scientific calculator", "extension cord", "uniform polo",
            "wooden bench"
  keywords: up to eight short words that are useful to a buyer and visibly true.
            Colours ("blue", "orange"), material ("wood", "plastic"), pattern,
            size, and the maker's name or model ONLY when it is legible in the
            picture ("casio", "fx-991ex", "nike"). Lowercase, one or two words
            each. An empty list is a correct answer for a picture that shows
            nothing worth naming.

Rules, in order of importance:
  1. Never invent a brand or a model number you cannot read in the picture.
  2. Never describe condition — "brand new", "original", "authentic", "rare" are
     claims you cannot see. Leave them out.
  3. Never repeat the item's category as a keyword ("electronics", "furniture"),
     and never add a price or a place.
  4. Describe only what is visible."""


class GeminiKeywordProvider:
    """The screening key, asked for words instead of a verdict."""

    name = "gemini-keywords"

    def __init__(self, api_key=None, model=None, timeout=None, transport=None):
        self.api_key = (
            getattr(settings, "SCREENING_API_KEY", "") if api_key is None else api_key
        )
        self.model = model or getattr(settings, "SCREENING_MODEL", "gemini-3.5-flash-lite")
        self.timeout = (
            getattr(settings, "KEYWORDS_TIMEOUT", 12.0) if timeout is None else timeout
        )
        self.transport = transport or post_json

    def _payload(self, raw: bytes, mime: str) -> dict:
        return {
            "systemInstruction": {"parts": [{"text": KEYWORDS_INSTRUCTION}]},
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {"text": "Label this picture."},
                        {
                            "inline_data": {
                                "mime_type": mime,
                                "data": base64.b64encode(raw).decode("ascii"),
                            }
                        },
                    ],
                }
            ],
            "generationConfig": {
                "temperature": 0.0,
                "maxOutputTokens": 600,
                "responseMimeType": "application/json",
                "responseSchema": KEYWORDS_SCHEMA,
            },
        }

    def describe(self, raw: bytes, mime: str = "image/jpeg") -> list:
        """Return the words the model chose, or [] when it could not answer."""
        payload_bytes, payload_mime = _downscaled(raw, mime)
        body = self.transport(
            GEMINI_ENDPOINT.format(model=self.model),
            self._payload(payload_bytes, payload_mime),
            {"x-goog-api-key": self.api_key, "Content-Type": "application/json"},
            self.timeout,
        )
        return words_from_answer(body)


def words_from_answer(body) -> list:
    """Pull the words out of a Gemini response, tolerating any shape.

    The provider answers `{"candidates": [{"content": {"parts": [{"text": ...}]}}]}`
    with the JSON we asked for inside `text`. Anything else — an error body, a
    refusal, a model that ignored the schema — is not an answer, and the caller
    indexes the listing on its text instead of guessing.
    """
    try:
        text = body["candidates"][0]["content"]["parts"][0]["text"]
        data = json.loads(text)
    except (KeyError, IndexError, TypeError, ValueError):
        return []
    if not isinstance(data, dict):
        return []
    words = []
    if isinstance(data.get("subject"), str):
        words.append(data["subject"])
    listed = data.get("keywords")
    if isinstance(listed, list):
        words.extend(word for word in listed if isinstance(word, str))
    return words


def get_keyword_provider():
    """The provider that may label pictures, or None when none is configured.

    Deliberately tied to the screening provider: if the project is running the
    stub (as the suite always does), there is no model to ask, and the listing
    is simply indexed on its text. That keeps every test offline and makes
    "labels appear" and "the key is configured" the same condition.
    """
    if not getattr(settings, "KEYWORDS_ENABLED", True):
        return None
    configured = (getattr(settings, "SCREENING_PROVIDER", "stub") or "stub").strip().lower()
    if configured != "gemini":
        return None
    if not (getattr(settings, "SCREENING_API_KEY", "") or "").strip():
        return None
    return GeminiKeywordProvider()


def normalise(words) -> str:
    """One searchable phrase: lowercase, deduplicated, bounded.

    A keyword that is not lowercase is a keyword the search will miss, so the
    case is folded here rather than relying on `icontains` to save us. Order is
    kept because the subject is the most useful term and the column is capped.
    """
    seen = []
    for word in words:
        if not isinstance(word, str):
            continue
        cleaned = " ".join(word.replace(",", " ").split()).strip(" .;:-").lower()
        if not cleaned or len(cleaned) > MAX_WORD_LENGTH:
            continue
        if cleaned in seen:
            continue
        seen.append(cleaned)
        if len(seen) >= MAX_WORDS:
            break
    return " ".join(seen)[:MAX_TEXT_LENGTH]


def describe(raw: bytes, mime: str = "image/jpeg") -> str:
    """Keywords for one picture, or "" when nothing can be said about it."""
    provider = get_keyword_provider()
    if provider is None:
        return ""
    try:
        return normalise(provider.describe(raw, mime))
    except Exception:  # noqa: BLE001 - a search aid must never break a post
        return ""
