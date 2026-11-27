"""Store search keywords on a listing, read from its photographs (BD-01).

The extractor lives in `apps.screening.keywords` because it is a vision call and
shares the screening provider. This module is the part that knows about the
catalogue: which picture to read, and where the answer is kept.

Bound on purpose:
  * one picture per listing (`MAX_PHOTOS`), the first in upload order — it is
    almost always the whole item, and the point is to make the listing findable,
    not to describe every angle;
  * the answer is written only when it differs, so re-saving a listing costs no
    UPDATE and no audit noise;
  * nothing is stored when the model could not answer, because an empty phrase
    is the honest state and `search_tags` is searched with `icontains`
    regardless.
"""

import mimetypes

from .models import Listing

from apps.screening import keywords as keyword_reader

MAX_PHOTOS = 1


def _mime_for(name: str) -> str:
    guessed, _ = mimetypes.guess_type(name or "")
    return guessed or "image/jpeg"


def read_keywords(listing) -> str:
    """The keyword phrase for a listing's first picture, or ""."""
    words = []
    photos = listing.photos.all().order_by("sort_order", "id")[:MAX_PHOTOS]
    for photo in photos:
        try:
            photo.image.open("rb")
            raw = photo.image.read()
        except Exception:  # noqa: BLE001 - a missing file is not a failed post
            continue
        finally:
            try:
                photo.image.close()
            except Exception:  # noqa: BLE001
                pass
        if not raw:
            continue
        phrase = keyword_reader.describe(raw, _mime_for(photo.image.name))
        if phrase:
            words.append(phrase)
    # `describe` already returns one normalised phrase; normalising again would
    # treat the whole phrase as a single "word" and drop it for exceeding
    # `MAX_WORD_LENGTH` (a real bench photo answered seven words, 48 characters,
    # and the second pass threw the lot away).
    return " ".join(words)[: keyword_reader.MAX_TEXT_LENGTH]


def stamp_search_tags(listing) -> str:
    """Read the listing's pictures and save the keywords on the row.

    Returns the phrase that is now stored. Never raises: a listing without
    keywords is still a listing, and the fallback is the seller's own text.
    """
    try:
        phrase = read_keywords(listing)
    except Exception:  # noqa: BLE001
        return listing.search_tags
    if phrase and phrase != listing.search_tags:
        Listing.objects.filter(pk=listing.pk).update(search_tags=phrase)
        listing.search_tags = phrase
    return listing.search_tags
