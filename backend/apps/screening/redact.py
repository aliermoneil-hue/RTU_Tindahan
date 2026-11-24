"""AI-09: the words the model is allowed to read.

The requirement is narrow and worth taking literally: send only the content being
checked, and only after removing names, contact numbers and other identifying
details. So this module takes the text as the member wrote it and hands back two
things — the cleaned text, and a short note of what was taken out, so the audit
row can say "3 details removed" rather than pretending nothing happened.

What is removed:

  email addresses          someone@example.com      -> [email]
  contact numbers          0917 123 4567, +63 917…  -> [contact number]
  RTU student numbers      2024-200797               -> [student number]
  social handles           @juan_dela                -> [handle]
  the author's own name    "Juan Dela Cruz" and its first and last tokens -> [name]

Names are the honest limit of this approach. Without a model to find them, only
the names the platform already knows can be removed — the author's own display
name, which is the one a listing most often carries ("I'm Juan, selling…"). A name
belonging to a third party, written into the text, is not detectable here, and
`docs/SCREENING.md` says so rather than implying the text is anonymous.

Redaction never touches the stored content: the listing or post keeps the words
the member wrote. Only the copy sent to the provider is cleaned.
"""

import re

PLACEHOLDER_EMAIL = "[email]"
PLACEHOLDER_PHONE = "[contact number]"
PLACEHOLDER_STUDENT = "[student number]"
PLACEHOLDER_HANDLE = "[handle]"
PLACEHOLDER_NAME = "[name]"

_EMAIL = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b")
# Philippine mobile numbers, with or without a country code, spaces, dots or
# dashes: 0917 123 4567, 09171234567, +63 917 123 4567, 63-917-123-4567.
_PHONE = re.compile(
    r"(?:\+?63[\s.-]?|0)9\d{2}[\s.-]?\d{3}[\s.-]?\d{4}\b"
    r"|(?:\+?63[\s.-]?|0)[2-8]\d{1,2}[\s.-]?\d{3,4}[\s.-]?\d{4}\b"
)
# The campus's own identifier: a year, a dash, six digits.
_STUDENT = re.compile(r"\b(?:19|20)\d{2}-\d{6}\b")
_HANDLE = re.compile(r"(?<![\w@])@[A-Za-z0-9_.]{2,30}\b")


def _name_patterns(name: str) -> list[re.Pattern]:
    """The author's name, and their first and last tokens, as whole words."""
    cleaned = (name or "").strip()
    if not cleaned:
        return []
    tokens = [t for t in re.split(r"\s+", cleaned) if len(t) >= 3]
    candidates = {cleaned.lower()}
    if tokens:
        candidates.add(tokens[0].lower())
        if len(tokens) > 1:
            candidates.add(tokens[-1].lower())
    return [
        re.compile(rf"(?<!\w){re.escape(token)}(?!\w)", re.IGNORECASE)
        for token in sorted(candidates, key=len, reverse=True)
    ]


def redact(text: str, *, names: list[str] | None = None) -> tuple[str, list[str]]:
    """Return the cleaned text and what was removed, in the order applied."""
    cleaned = text or ""
    removed: list[str] = []

    for pattern, placeholder, label in (
        (_EMAIL, PLACEHOLDER_EMAIL, "email address"),
        (_STUDENT, PLACEHOLDER_STUDENT, "student number"),
        (_PHONE, PLACEHOLDER_PHONE, "contact number"),
        (_HANDLE, PLACEHOLDER_HANDLE, "handle"),
    ):
        cleaned, count = pattern.subn(placeholder, cleaned)
        if count:
            removed.append(f"{count} {label}{'' if count == 1 else 's'}")

    name_hits = 0
    for name in names or []:
        # Every pattern is applied, not just the first that matches: the full
        # name appears once and the bare first name three lines later, and both
        # are the member's identity.
        for pattern in _name_patterns(name):
            cleaned, count = pattern.subn(PLACEHOLDER_NAME, cleaned)
            name_hits += count
    if name_hits:
        removed.append(f"{name_hits} name mention{'' if name_hits == 1 else 's'}")

    return cleaned, removed


def summarize(removed: list[str]) -> str:
    """One line for the audit row: "2 contact numbers, 1 name mention"."""
    return ", ".join(removed)
