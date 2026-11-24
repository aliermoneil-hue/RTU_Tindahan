"""Content screening for pictures (an extension to AI-01).

AI-01 asks the model to check the *text* of a listing or a post. A photograph can
carry what the text does not: a counterfeit, a weapon, an answer key photographed
on a desk, a screenshot of a chat that names someone. Text screening cannot see
any of it, so a listing whose words are clean and whose pictures are not went
straight through to a moderator's approval queue with nothing said about the
picture — and, once approved, to the campus.

This module closes that by asking the same provider to look at the picture with
the same three outcomes:

  clean     the picture shows nothing the university's rules prohibit
  flagged   something needs a person to look at it
  rejected  the picture shows a prohibited thing

Two rules shaped it:

  **It fails closed.** No key, a timeout, an unreadable answer — all become
  "flagged", never "clean". A model we could not ask is not a model that said the
  picture was fine. This is the same rule AI-07 already applies to text.

  **It is bounded.** At most `SCREENING_IMAGE_MAX` pictures are checked per
  submission (the first ones, in upload order), and each is downscaled before it
  is sent, so a listing with five 5 MB photos cannot turn one submit into a minute
  of upload. The count that was actually checked is written to the audit row, so
  the log never implies more coverage than there was.

Images are sent as inline bytes, never as a URL: the campus server is not
reachable from the internet's model endpoints, and a public link to a member's
photo would be a privacy leak dressed as a convenience.
"""

import base64
import io

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.core.files.base import ContentFile

from .providers import GEMINI_ENDPOINT, GEMINI_SCHEMA, Verdict, post_json

MAX_SIDE = 1024  # pixels; enough to read a screenshot, small enough to be quick

IMAGE_INSTRUCTION = """You are screening a photograph that a student wants to publish on
an RTU campus marketplace listing or forum post.

Decide whether the PICTURE ITSELF shows anything the university's posting rules
prohibit. Prohibited: weapons and imitation firearms, drugs and vapes, alcohol,
counterfeit or pirated goods, gambling, exam answer keys and completed homework
offered for sale, sexually explicit material, someone's ID or private documents,
and any image whose purpose is to harass or humiliate a person.

Text inside the picture counts: a screenshot offering an answer key, or a chat
naming and mocking someone, is prohibited even if the image is "just" a
screenshot. A normal product photo, a person holding an item, a screenshot of a
price list, or a picture with a watermark is fine.

Answer with JSON only:
  verdict: "clean", "flagged" or "rejected"
  score: 0-100, how strongly it matches a prohibited category
  reasons: up to three short phrases naming what you saw (empty when clean)
  confidence: 0 to 1, how sure you are

Use "flagged" when the picture is ambiguous or you cannot tell what it shows.
Never guess "clean" to be helpful."""


def _downscaled(raw: bytes, mime: str) -> tuple[bytes, str]:
    """Shrink to MAX_SIDE and re-encode as JPEG, dropping EXIF on the way.

    The model does not need 4000 px, and the re-encode removes the camera's EXIF
    block — which on a phone photo includes the coordinates where it was taken.
    """
    from PIL import Image

    with Image.open(io.BytesIO(raw)) as probe:
        probe.load()
        image = probe.convert("RGB")
    if max(image.size) > MAX_SIDE:
        image.thumbnail((MAX_SIDE, MAX_SIDE))
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=85)
    return buffer.getvalue(), "image/jpeg"


class GeminiVisionProvider:
    """The same Gemini key, asked about a picture instead of words."""

    name = "gemini-vision"

    def __init__(self, api_key=None, model=None, timeout=None, transport=None):
        self.api_key = (
            getattr(settings, "SCREENING_API_KEY", "") if api_key is None else api_key
        )
        self.model = model or getattr(settings, "SCREENING_MODEL", "gemini-3.5-flash-lite")
        self.timeout = (
            getattr(settings, "SCREENING_IMAGE_TIMEOUT", 25.0) if timeout is None else timeout
        )
        self.transport = transport or post_json
        if not self.api_key:
            raise ImproperlyConfigured(
                "Image screening needs LLM_API_KEY in backend/.env, the same key text "
                "screening uses. Without it the picture would be published unchecked."
            )

    def _payload(self, raw: bytes, mime: str) -> dict:
        from . import rules

        banned = rules.phrases("prohibited")
        instruction = (
            IMAGE_INSTRUCTION
            + "\n\nThe current prohibited terms, maintained by the administrator: "
            + ", ".join(banned)
            + "."
        )
        return {
            "systemInstruction": {"parts": [{"text": instruction}]},
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {"text": "Screen this picture."},
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
                "temperature": 0.1,
                "maxOutputTokens": 300,
                "responseMimeType": "application/json",
                "responseSchema": GEMINI_SCHEMA,
            },
        }

    def screen(self, raw: bytes, mime: str = "image/jpeg") -> Verdict:
        import json
        from urllib.error import URLError

        payload_bytes, payload_mime = _downscaled(raw, mime)
        data = self.transport(
            GEMINI_ENDPOINT.format(model=self.model),
            self._payload(payload_bytes, payload_mime),
            {"x-goog-api-key": self.api_key, "Content-Type": "application/json"},
            self.timeout,
        )

        candidates = data.get("candidates") or []
        if not candidates:
            raise URLError("Gemini returned no candidates for the picture.")
        parsed = json.loads(candidates[0]["content"]["parts"][0]["text"])

        answered = str(parsed.get("verdict") or "").strip().lower()
        verdict = answered if answered in ("clean", "flagged", "rejected") else "flagged"
        try:
            confidence = float(parsed.get("confidence"))
        except (TypeError, ValueError):
            confidence = 0.5
        confidence = min(max(confidence, 0.0), 1.0)
        try:
            score = int(parsed.get("score"))
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
            confidence=confidence,
            provider=self.name,
            model=self.model,
            raw=parsed if isinstance(parsed, dict) else {},
        )


def screen_image(raw: bytes, mime: str = "image/jpeg") -> Verdict:
    """Screen one picture. Raises when no provider is configured — callers fail closed."""
    return GeminiVisionProvider().screen(raw, mime)


def read_upload(image) -> tuple[bytes, str]:
    """The bytes and mime type of an uploaded photo, rewound for later use."""
    image.seek(0)
    raw = image.read()
    image.seek(0)
    return raw, "image/jpeg"


def strip_metadata(image) -> ContentFile:
    """Re-encode an uploaded photo as JPEG: no EXIF, no GPS, no polyglot payload.

    A JPEG whose bytes also parse as HTML is a stored-XSS waiting for a browser
    that trusts the extension, and a phone photo carries where it was taken. Both
    are thrown away by decoding the pixels and writing a fresh file.
    """
    from PIL import Image

    image.seek(0)
    with Image.open(image) as probe:
        probe.load()
        frame = probe.convert("RGB")
    buffer = io.BytesIO()
    frame.save(buffer, format="JPEG", quality=88)
    image.seek(0)
    return ContentFile(buffer.getvalue())
