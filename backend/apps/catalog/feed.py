"""BD-07: the default feed's hybrid score, and what it is made of.

The requirement asks for three things at once, and each is a small decision:

  * **popularity** — how much attention a listing has had. Three signals exist
    already and are counted in the database: saves (`favorited_by`), views
    (`view_count`) and units sold (`sold_count`). A save is worth more than a
    view (it is a decision, not a glance) and a sale is worth most.
  * **recency with time decay** — a listing's score halves every
    `FEED_HALF_LIFE_HOURS`, so last month's popular item sinks below this
    morning's good one without anyone deleting or demoting it. A half-life rather
    than a cliff, because a step change makes a whole page of results jump at
    midnight.
  * **text relevance when searching** — a matching word in the title counts
    double one in the description, and every matched word adds to the score.
  * **no personal history** — the score is computed from the listing's own
    columns and its own counts. Nothing about the reader enters it, so two
    students see the same order for the same query. That is a requirement, not a
    limitation, and it is asserted by a test.

The weights live in settings so a panelist asking "why is this first?" gets a
number rather than a shrug: `FEED_WEIGHT_SAVE`, `FEED_WEIGHT_VIEW`,
`FEED_WEIGHT_SOLD`, `FEED_RELEVANCE_WEIGHT`, `FEED_HALF_LIFE_HOURS`.

Ordering stays in SQL rather than in Python: the feed is paginated, and a score
applied after the page is chosen would sort a page of twenty, not the catalogue.
"""

import math
import re

from django.conf import settings
from django.db.models import Count, F, FloatField, IntegerField, Q, Value
from django.db.models.expressions import Case, ExpressionWrapper, When
from django.db.models.functions import Coalesce, Exp, Greatest, Ln, Now
from django.utils import timezone

DEFAULT_HALF_LIFE_HOURS = 72.0
DEFAULT_WEIGHTS = {"save": 3.0, "view": 0.5, "sold": 4.0, "relevance": 6.0}


def weights() -> dict:
    return {
        "save": float(getattr(settings, "FEED_WEIGHT_SAVE", DEFAULT_WEIGHTS["save"])),
        "view": float(getattr(settings, "FEED_WEIGHT_VIEW", DEFAULT_WEIGHTS["view"])),
        "sold": float(getattr(settings, "FEED_WEIGHT_SOLD", DEFAULT_WEIGHTS["sold"])),
        "relevance": float(
            getattr(settings, "FEED_RELEVANCE_WEIGHT", DEFAULT_WEIGHTS["relevance"])
        ),
    }


def half_life_hours() -> float:
    value = float(getattr(settings, "FEED_HALF_LIFE_HOURS", DEFAULT_HALF_LIFE_HOURS))
    # A half-life of zero would divide by zero; a negative one would reward age.
    return value if value > 0 else DEFAULT_HALF_LIFE_HOURS


def search_terms(search: str) -> list[str]:
    """The words a search is scored on: lower-cased, de-duplicated, short ones dropped."""
    words = re.findall(r"[A-Za-z0-9]+", (search or "").lower())
    seen: list[str] = []
    for word in words:
        if len(word) >= 2 and word not in seen:
            seen.append(word)
    return seen[:8]


def annotate_feed_score(queryset, search: str = ""):
    """Attach `feed_score` to a listing queryset and hand it back.

    `favorite_count` is annotated here with a subquery-free join; the caller may
    already have joined reviews, so the count is filtered to the listing's own
    favourites and the queryset is expected to be `.distinct()`-safe (one row per
    listing) — the catalogue's own queryset already de-duplicates.
    """
    weight = weights()

    # Attention is heavy-tailed: the gap between 400 and 450 views is not the gap
    # between 0 and 50, so every count is compressed with ln(1 + n). Without it a
    # single popular listing flattens the recency half of the score and the feed
    # stops being hybrid at all.
    popularity = ExpressionWrapper(
        Value(weight["save"]) * Ln(Value(1.0) + Coalesce(F("favorite_count"), Value(0)))
        + Value(weight["view"]) * Ln(Value(1.0) + Coalesce(F("view_count"), Value(0)))
        + Value(weight["sold"]) * Ln(Value(1.0) + Coalesce(F("sold_count"), Value(0))),
        output_field=FloatField(),
    )
    # 0.5 ** (age / half_life) == exp(-ln2 * age / half_life). Both forms are
    # one SQL function call; Exp is the one SQLite and PostgreSQL both provide.
    age_days = ExpressionWrapper(
        (Now() - F("created_at")) / Value(86400.0),
        output_field=FloatField(),
    )
    decay = Exp(
        ExpressionWrapper(
            -Value(0.6931471805599453)
            * age_days
            * Value(24.0 / half_life_hours()),
            output_field=FloatField(),
        )
    )
    score = ExpressionWrapper(popularity * decay, output_field=FloatField())

    terms = search_terms(search)
    if terms:
        relevance = None
        for term in terms:
            hit = Case(
                When(title__icontains=term, then=Value(2.0)),
                When(description__icontains=term, then=Value(1.0)),
                default=Value(0.0),
                output_field=FloatField(),
            )
            relevance = hit if relevance is None else relevance + hit
        score = ExpressionWrapper(
            score + Value(weight["relevance"]) * relevance, output_field=FloatField()
        )

    return queryset.annotate(
        favorite_count=Coalesce(Count("favorited_by", distinct=True), Value(0)),
    ).annotate(
        # At least a hair above zero: a brand-new listing with no views still
        # deserves to appear rather than sort as NULL.
        feed_score=Greatest(score, Value(0.000001)),
    )


def explain(listing, *, search: str = "") -> dict:
    """Why this listing scores what it does — the numbers a panelist would ask for."""
    weight = weights()
    age_hours = max((timezone.now() - listing.created_at).total_seconds() / 3600.0, 0.0)
    half_life = half_life_hours()
    decay = 0.5 ** (age_hours / half_life)
    saves = getattr(listing, "favorite_count", None)
    if saves is None:
        saves = listing.favorited_by.count() if hasattr(listing, "favorited_by") else 0
    view_count = listing.view_count or 0
    sold = listing.sold_count or 0
    # The same compression the query uses, so the explanation matches the order.
    popularity = (
        weight["save"] * math.log1p(saves)
        + weight["view"] * math.log1p(view_count)
        + weight["sold"] * math.log1p(sold)
    )

    relevance = 0.0
    hits = []
    text_title = (listing.title or "").lower()
    text_body = (listing.description or "").lower()
    for term in search_terms(search):
        if term in text_title:
            relevance += 2.0
            hits.append(f"{term} in title")
        elif term in text_body:
            relevance += 1.0
            hits.append(f"{term} in description")

    return {
        "weights": weight,
        "half_life_hours": half_life,
        "age_hours": round(age_hours, 2),
        "decay": round(decay, 6),
        "saves": saves,
        "views": view_count,
        "sold": sold,
        "popularity": round(popularity, 4),
        "relevance": round(relevance, 4),
        "score": round(popularity * decay + weight["relevance"] * relevance, 6),
        "search_hits": hits,
    }
