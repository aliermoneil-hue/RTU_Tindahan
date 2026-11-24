"""The screening terms, read from the table an administrator owns (AI-10).

Two rules of behaviour matter here:

- **the code is the floor.** If the table is empty — a fresh database, a test
  that never ran the data migration, a mistaken wipe — the terms baked into
  `providers.py` are used, so screening never silently stops working;
- **an edit is visible in a minute, not a deploy.** The active list is cached for
  60 seconds under one key, and every save or delete clears it, so staff see
  their change on the next item and screening still costs no query per listing.
"""

from django.core.cache import cache

CACHE_KEY = "screening:rules:v1"
CACHE_SECONDS = 60


def _code_default(kind):
    from . import providers

    if kind == "prohibited":
        return list(providers.PROHIBITED_TERMS)
    return list(providers.SCAM_PATTERNS)


def phrases(kind):
    """The active phrases of one kind, from the table or from the code."""
    cached = cache.get(CACHE_KEY)
    if cached is None:
        cached = _load()
        cache.set(CACHE_KEY, cached, CACHE_SECONDS)
    chosen = cached.get(kind) or []
    return chosen or _code_default(kind)


def _load():
    from .models import ScreeningRule

    loaded = {"prohibited": [], "scam": []}
    # If the table cannot be read at all (mid-migration, permissions), the code
    # defaults apply and screening keeps working.
    try:
        rows = ScreeningRule.objects.filter(is_active=True).values_list("kind", "phrase")
    except Exception:  # pragma: no cover - only on a half-built database
        return loaded
    for kind, phrase in rows:
        if kind in loaded and phrase:
            loaded[kind].append(phrase)
    return loaded


def invalidate():
    """Forget the cache; called whenever a rule is saved or deleted."""
    cache.delete(CACHE_KEY)
