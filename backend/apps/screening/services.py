"""Run a screen and record the verdict.

The one rule this module enforces: screening never publishes.

For a listing, a clean verdict leaves it waiting for a moderator exactly as
before the service existed, and a flagged verdict sends it to `needs_review`.

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


def _store(target, *, verdict, score, reasons, provider, model="", raw=None):
    return ScreeningResult.objects.create(
        **target,
        verdict=verdict,
        score=score,
        reasons=reasons,
        provider=provider,
        model_name=model,
        raw=raw or {},
    )


def _run(target, subject) -> ScreeningResult:
    """Screen one subject, store the verdict, and return the audit row.

    `target` is `{"listing": row}` or `{"post": row}`; a row in the audit table
    names exactly one of the two.
    """
    configured = (getattr(settings, "SCREENING_PROVIDER", "stub") or "stub").lower()

    try:
        verdict = get_provider().screen(subject)
    except Exception as exc:  # noqa: BLE001 - any provider failure lands here
        error = type(exc).__name__
        if getattr(settings, "SCREENING_FALLBACK", True):
            fallback = StubProvider().screen(subject)
            result = _store(
                target,
                verdict=fallback.verdict,
                score=fallback.score,
                reasons=[FALLBACK_REASON.format(provider=configured, error=error)]
                + fallback.reasons,
                provider=f"{configured}+fallback",
                model=fallback.model,
                raw={"provider_error": error, **fallback.raw},
            )
        else:
            result = _store(
                target,
                verdict=ScreeningResult.Verdict.FLAGGED,
                score=None,
                reasons=[
                    PROVIDER_FAILED_REASON,
                    f"{error}: {str(exc)[:200]}",
                ],
                provider="error",
                raw={"provider_error": error},
            )
    else:
        result = _store(
            target,
            verdict=verdict.verdict,
            score=verdict.score,
            reasons=verdict.reasons,
            provider=verdict.provider,
            model=verdict.model,
            raw=verdict.raw,
        )

    return result


@transaction.atomic
def run_screening(listing) -> ScreeningResult:
    """Screen one listing, store the result, and move the status if needed."""
    result = _run({"listing": listing}, TextSubject.for_listing(listing))
    if (
        result.is_flagged
        and listing.moderation_status != Listing.ModerationStatus.NEEDS_REVIEW
    ):
        listing.send_to_review()
    return result


@transaction.atomic
def run_post_screening(post) -> ScreeningResult:
    """Screen one forum post and hold it if the verdict flags it (AI-03).

    A held post keeps its row, stays readable by its author and by staff, and
    waits for a moderator; restoring it (`POST /forum/posts/<id>/moderate/`
    with `{"action": "restore"}`) puts it back in the public feed. The author
    is told once, and the moderator queue hears about it, because a post that
    silently disappears is the worst of the three outcomes.
    """
    result = _run({"post": post}, TextSubject.for_post(post))

    if not result.is_flagged:
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
def run_comment_screening(comment) -> ScreeningResult:
    """Screen one forum comment and hold it if the verdict flags it (AI-03).

    A comment is the loudest channel on the site — it publishes inside someone
    else's thread the moment it is typed. A flagged one is held out of the
    thread for everyone but its author and staff; releasing it is the same
    moderator action that restores a hidden comment.
    """
    result = _run({"comment": comment}, TextSubject.for_comment(comment))

    if not result.is_flagged:
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
