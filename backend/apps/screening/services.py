"""Run a screen and record the verdict.

The one rule this module enforces: screening never publishes.

For a listing, a clean verdict leaves it waiting for a moderator exactly as
before the service existed, a flagged verdict sends it to `needs_review`, and a
`rejected` verdict — a definite, rule-level violation — marks it rejected and
leaves it in the moderator queue for confirmation. A rejection is never final:
a moderator can reverse it, and `reverse` publishes (AI-11).

A verdict with confidence below `SCREENING_CONFIDENCE_FLOOR` is treated as
needs-review whatever it says (AI-12), because an unsure model is not evidence.

For a forum post there is no "pending" state to leave alone — a post is live
the moment it is written — so the safe default inverts: clean leaves the post
visible, and flagged *holds* it (`moderation_status=needs_review`), which takes
it out of the public feed and puts it in front of a moderator. Holding is not
publishing, which is what keeps the gate safe.

When the configured provider fails — a timeout, an exhausted quota, a retired
model name — there are two honest answers, and `LLM_FALLBACK` picks one:

  true (default)   the deterministic rules provider answers instead, and the
                   audit row says so. A listing still gets screened, and a
                   human still approves it, so the gate is never open. This is
                   what keeps a demo alive when a free tier runs dry mid-flow.
  false            the item goes to review unscreened, with the provider error
                   recorded as the reason.

Neither answer publishes anything (a failed screening holds the post), which is
why falling back is safe here and would not be safe in a system that
auto-approved clean verdicts.
"""

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.catalog.models import Listing
from apps.forum.models import ForumComment, ForumPost
from apps.notifications.models import Notification
from apps.notifications.services import notify, notify_staff

from .models import ScreeningResult
from .providers import StubProvider, TextSubject, get_provider

PROVIDER_FAILED_REASON = (
    "Automatic screening could not run. A moderator must look at this item."
)
FALLBACK_REASON = (
    "The {provider} provider failed ({error}), so the rules check answered."
)


def _store(
    target,
    *,
    verdict,
    score,
    reasons,
    provider,
    model="",
    confidence=None,
    raw=None,
    subject=None,
    pictures_checked=0,
    pictures=None,
):
    """Write the audit row (AI-08), including the cleaned text the provider read.

    `pictures` are the image verdicts; the worse of text and pictures is the one
    stored, and the count says how many pictures were actually looked at.
    """
    screened_text = ""
    redactions = ""
    if subject is not None:
        text_of = getattr(subject, "as_text", None)
        screened_text = text_of() if callable(text_of) else ""
        redactions = getattr(subject, "redactions", "") or ""
    if pictures:
        from .providers import Verdict as _Verdict

        combined = _combine(
            _Verdict(
                verdict=verdict,
                score=score,
                reasons=list(reasons),
                confidence=confidence,
                provider=provider,
                model=model,
                raw=raw or {},
            ),
            pictures,
        )
        verdict = combined.verdict
        score = combined.score
        reasons = combined.reasons
        confidence = combined.confidence
    return ScreeningResult.objects.create(
        **target,
        verdict=verdict,
        score=score,
        reasons=reasons,
        confidence=confidence,
        provider=provider,
        model_name=model,
        raw=raw or {},
        screened_text=screened_text,
        redactions=redactions,
        images_checked=pictures_checked,
    )


IMAGE_RANK = {"clean": 0, "flagged": 1, "rejected": 2}


def _screen_pictures(pictures) -> tuple[list, int]:
    """Screen the pictures, worst-verdict-wins, and never let a failure pass.

    `pictures` is a list of uploaded files. At most `SCREENING_IMAGE_MAX` are
    checked. A picture that could not be checked becomes "flagged" with the
    reason, because a model we could not ask is not a model that said it was fine.
    """
    from .images import read_upload

    limit = int(getattr(settings, "SCREENING_IMAGE_MAX", 4) or 0)
    verdicts = []
    checked = 0
    for picture in list(pictures)[:limit]:
        checked += 1
        try:
            raw, mime = read_upload(picture)
            from .images import screen_image

            verdicts.append(screen_image(raw, mime))
        except Exception as exc:  # noqa: BLE001 - any failure is a "look at it"
            from .providers import Verdict

            verdicts.append(
                Verdict(
                    verdict="flagged",
                    score=None,
                    reasons=[f"A picture could not be checked ({type(exc).__name__})."],
                    confidence=0.0,
                    provider="error",
                )
            )
    return verdicts, checked


def _combine(text_verdict, picture_verdicts):
    """The worse of the text and the pictures, with the reasons that earned it.

    Ties keep both sets: a listing whose words and photo were both flagged should
    say so, and a moderator reading "Image: …" beside a text reason knows which
    of the two to open first.
    """
    if not picture_verdicts:
        return text_verdict

    from .providers import Verdict

    text_rank = IMAGE_RANK.get(text_verdict.verdict, 1)
    picture_rank = max(IMAGE_RANK.get(v.verdict, 1) for v in picture_verdicts)
    final_rank = max(text_rank, picture_rank)

    picture_reasons = [
        f"Image: {reason}"
        for verdict in picture_verdicts
        if final_rank == picture_rank
        for reason in (verdict.reasons or [])
    ]
    text_reasons = list(text_verdict.reasons or []) if text_rank == final_rank else []
    reasons = (picture_reasons + text_reasons)[:4]

    confidences = [c for c in [text_verdict.confidence] if c is not None] + [
        v.confidence for v in picture_verdicts if v.confidence is not None
    ]

    if picture_rank > text_rank:
        winner = next(
            v for v in picture_verdicts if IMAGE_RANK.get(v.verdict, 1) == picture_rank
        )
        return Verdict(
            verdict=winner.verdict,
            score=winner.score,
            reasons=reasons,
            confidence=min(confidences or [0.0]),
            provider=winner.provider,
            model=getattr(winner, "model", ""),
            raw=getattr(winner, "raw", {}) or {},
        )

    return Verdict(
        verdict=text_verdict.verdict,
        score=text_verdict.score,
        reasons=reasons or list(text_verdict.reasons or []),
        confidence=min(confidences or [0.0]),
        provider=text_verdict.provider,
        model=getattr(text_verdict, "model", ""),
        raw=getattr(text_verdict, "raw", {}) or {},
    )


def _run(target, subject, pictures=()) -> ScreeningResult:
    """Screen one subject, store the verdict, and return the audit row.

    `target` is `{"listing": row}` or `{"post": row}`; a row in the audit table
    names exactly one of the two. `pictures` are the uploaded images that will be
    published with it — text screening cannot see what is in them, so they are
    checked too and the worse verdict wins.
    """
    configured = (getattr(settings, "SCREENING_PROVIDER", "stub") or "stub").lower()

    # AI-01 extension: the pictures are screened first, because a rejected picture
    # makes the text verdict irrelevant, and the audit row must carry both.
    mode = (getattr(settings, "SCREENING_IMAGES", "enforce") or "off").strip().lower()
    if mode == "enforce" and pictures:
        picture_verdicts, pictures_checked = _screen_pictures(pictures)
    else:
        picture_verdicts, pictures_checked = [], 0

    try:
        verdict = get_provider().screen(subject)
    except Exception as exc:  # noqa: BLE001 - any provider failure lands here
        error = type(exc).__name__
        if getattr(settings, "SCREENING_FALLBACK", True):
            fallback = StubProvider().screen(subject)
            result = _store(
                target,
                subject=subject,
                verdict=fallback.verdict,
                score=fallback.score,
                reasons=[FALLBACK_REASON.format(provider=configured, error=error)]
                + fallback.reasons,
                provider=f"{configured}+fallback",
                model=fallback.model,
                confidence=fallback.confidence,
                raw={"provider_error": error, **fallback.raw},
                pictures_checked=pictures_checked,
                pictures=picture_verdicts,
            )
        else:
            result = _store(
                target,
                subject=subject,
                verdict=ScreeningResult.Verdict.FLAGGED,
                score=None,
                reasons=[
                    PROVIDER_FAILED_REASON,
                    f"{error}: {str(exc)[:200]}",
                ],
                provider="error",
                raw={"provider_error": error},
                pictures_checked=pictures_checked,
                pictures=picture_verdicts,
            )
    else:
        result = _store(
            target,
            subject=subject,
            verdict=verdict.verdict,
            score=verdict.score,
            reasons=verdict.reasons,
            provider=verdict.provider,
            model=verdict.model,
            confidence=verdict.confidence,
            raw=verdict.raw,
            pictures_checked=pictures_checked,
            pictures=picture_verdicts,
        )

    return result


def confidence_floor() -> float:
    return float(getattr(settings, "SCREENING_CONFIDENCE_FLOOR", 0.7))


def needs_a_human(result) -> bool:
    """AI-11 and AI-12: anything but a confident clean pass belongs to a person.

    A rejection is in this set on purpose. The AI is never the final authority,
    so its strongest negative answer still waits for a moderator to confirm it.
    """
    if result.verdict == ScreeningResult.Verdict.CLEAN:
        return result.confidence is not None and result.confidence < confidence_floor()
    return True


@transaction.atomic
def listing_pictures(listing):
    """The uploaded photos of a listing, in the order the seller gave them."""
    return [photo.image for photo in listing.photos.all().order_by("sort_order", "id")]


def run_screening(listing) -> ScreeningResult:
    """Screen one listing, store the result, and move the status if needed."""
    result = _run(
        {"listing": listing},
        TextSubject.for_listing(listing),
        pictures=listing_pictures(listing),
    )

    if result.verdict == ScreeningResult.Verdict.REJECTED:
        # AI-11: rejected, and queued. The reason travels to the seller so the
        # notice is not a bare "no".
        if listing.moderation_status != Listing.ModerationStatus.REJECTED:
            reason = "; ".join(result.reasons) or "It matched a prohibited-item rule."
            listing.reject(reason[:300])
            # AI-11: a rejection is a claim a moderator will check, so the seller
            # is told the claim, told it is being checked, and told they can
            # appeal — which is what makes the reversal path reachable at all.
            summary = (listing.title or f"Listing {listing.pk}").strip()[:60]
            notify(
                listing.seller,
                f'Your listing "{summary}" was rejected by the automatic screening: '
                f"{reason} A moderator will check it, and you can appeal this decision."
                [:240],
                kind=Notification.Kind.LISTING,
                link_kind="shop",
                link_id=listing.slug,
            )
            notify_staff(
                f'Screening rejected a listing: "{summary}". {reason}'[:240],
                link_kind="approval",
                link_id=listing.slug,
            )
        return result

    if list(
        ScreeningResult.objects.filter(listing=listing, decision="", verdict="rejected")
    ) and result.verdict != ScreeningResult.Verdict.REJECTED:
        # A later clean screening of an AI-rejected listing does not silently
        # publish it: the rejection stays until a moderator decides.
        return result

    if (
        needs_a_human(result)
        and listing.moderation_status != Listing.ModerationStatus.NEEDS_REVIEW
    ):
        listing.send_to_review()
    return result


def record_moderator_decision(*, target, decision, moderator, note=""):
    """AI-15: stamp the human's answer on the latest screening row.

    `target` is a listing, a post or a comment. The AI's own verdict is left
    untouched — the point is to keep the two side by side so accuracy can be
    measured later, not to overwrite what the machine said.
    """
    field = (
        "listing"
        if isinstance(target, Listing)
        else "post"
        if isinstance(target, ForumPost)
        else "comment"
    )
    latest = (
        ScreeningResult.objects.filter(**{field: target}).order_by("-created_at").first()
    )
    if latest is None:
        return None
    latest.decision = decision
    latest.decided_by = moderator
    latest.decided_at = timezone.now()
    latest.decision_note = (note or "")[:300]
    latest.save(update_fields=["decision", "decided_by", "decided_at", "decision_note"])
    return latest


@transaction.atomic
def run_post_screening(post) -> ScreeningResult:
    """Screen one forum post and hold it if the verdict flags it (AI-03).

    A held post keeps its row, stays readable by its author and by staff, and
    waits for a moderator; restoring it (`POST /forum/posts/<id>/moderate/`
    with `{"action": "restore"}`) puts it back in the public feed. The author
    is told once, and the moderator queue hears about it, because a post that
    silently disappears is the worst of the three outcomes.
    """
    # The pictures on a post are stored files, not uploads, so they are opened
    # from storage and handed to the same picture screen.
    from django.core.files.storage import default_storage

    pictures = []
    for name in post.images or []:
        try:
            pictures.append(default_storage.open(name, "rb"))
        except Exception:  # noqa: BLE001 - a missing file is not a reason to publish
            pictures.append(None)

    result = _run(
        {"post": post},
        TextSubject.for_post(post),
        pictures=[p for p in pictures if p is not None],
    )

    # A post has no rejected state: everything that is not a confident clean
    # pass is held (AI-03), which is also where a low confidence belongs (AI-12).
    if result.verdict == ScreeningResult.Verdict.CLEAN and not needs_a_human(result):
        return result
    if post.moderation_status == ForumPost.ModerationStatus.NEEDS_REVIEW:
        return result

    post.hold_for_review()
    summary = (post.title or post.body or f"Post {post.pk}").strip()[:60]
    reason = (result.reasons or ["It matched the automatic screening rules."])[0]

    if post.author_id:
        notify(
            post.author,
            f'Your post "{summary}" is held for review: {reason}'[:240],
            kind=Notification.Kind.SYSTEM,
            link_kind="post",
            link_id=post.pk,
        )
    notify_staff(
        f'A forum post was held by screening: "{summary}". {reason}'[:240],
        link_id=post.pk,
    )
    return result


@transaction.atomic
def run_review_screening(review) -> ScreeningResult:
    """RR-06: screen an edited review before the change is published.

    Only an edit is screened. A first review publishes at once, which is a
    deliberate decision recorded against RR-04: a critical rating of a seller
    must not wait on a machine to approve it. An edit is different — it is how
    innocent text becomes abuse after the seller has already answered, so the
    change waits for a person while the old text stays as it was.

    Reviews are judged against the prohibited list only. A review that mentions
    a phone number or a GCash request is describing what happened, not offering
    it, so the listing-only signals are skipped by the provider itself.
    """
    from apps.reviews.models import Review

    result = _run(
        {"review": review},
        TextSubject(kind="review", title="", description=review.text or ""),
    )

    if result.verdict == ScreeningResult.Verdict.CLEAN and not needs_a_human(result):
        review.moderation_status = Review.ModerationStatus.VISIBLE
        review.held_reason = ""
        review.save(update_fields=["moderation_status", "held_reason"])
        return result

    review.moderation_status = Review.ModerationStatus.NEEDS_REVIEW
    review.held_reason = "; ".join(result.reasons or ["It matched the screening rules."])[:240]
    review.save(update_fields=["moderation_status", "held_reason"])

    summary = (review.text or f"Review {review.pk}").strip()[:60]
    notify_staff(
        f"An edited review is held for review: \"{summary}\"."[:240],
        link_kind="reviews",
        link_id=str(review.pk),
    )
    if review.buyer_id:
        notify(
            review.buyer,
            "Your edited review is held for review. The published review is unchanged until a "
            "moderator looks at it.",
            kind=Notification.Kind.REVIEW,
            link_kind="reviews",
            link_id=str(review.pk),
        )
    return result


@transaction.atomic
def run_comment_screening(comment) -> ScreeningResult:
    """Screen one forum comment and hold it if the verdict flags it (AI-03).

    A comment is the loudest channel on the site — it publishes inside someone
    else's thread the moment it is typed. A flagged one is held out of the
    thread for everyone but its author and staff; releasing it is the same
    moderator action that restores a hidden comment.
    """
    result = _run({"comment": comment}, TextSubject.for_comment(comment))

    if result.verdict == ScreeningResult.Verdict.CLEAN and not needs_a_human(result):
        return result
    if comment.moderation_status == ForumComment.ModerationStatus.NEEDS_REVIEW:
        return result

    comment.hold_for_review()
    summary = (comment.text or f"Comment {comment.pk}").strip()[:60]
    reason = (result.reasons or ["It matched the automatic screening rules."])[0]

    if comment.author_id:
        notify(
            comment.author,
            f'Your comment "{summary}" is held for review: {reason}'[:240],
            kind=Notification.Kind.SYSTEM,
            link_kind="post",
            link_id=comment.post_id,
        )
    notify_staff(
        f'A forum comment was held by screening: "{summary}". {reason}'[:240],
        link_id=comment.post_id,
    )
    return result
