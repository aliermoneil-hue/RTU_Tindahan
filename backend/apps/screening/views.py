"""The moderator queue (AI-04, AI-11) and the screening audit trail (AI-08).

Two read-only endpoints plus the decision endpoint:

    GET  /api/v1/moderation/queue/            moderators: items waiting
    GET  /api/v1/moderation/screening-log/    moderators: every screening
    POST /api/v1/moderation/<log>/decide/     moderators: confirm or reverse

The queue is built from Listing rows whose status is `needs_review` or
`rejected`, because AI-11 says a rejected item still needs a human to confirm
it. Reversing a rejection publishes the listing.
"""

from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import IsModerator
from apps.catalog.models import Listing
from apps.catalog.serializers import ListingReadSerializer

from .models import ModerationDecision, ScreeningLog
from .serializers import ScreeningLogSerializer
from . import services

WAITING = (Listing.Status.NEEDS_REVIEW, Listing.Status.REJECTED)


class ModerationQueueViewSet(viewsets.GenericViewSet, mixins.ListModelMixin):
    serializer_class = ListingReadSerializer
    permission_classes = [IsModerator]
    lookup_field = "slug"

    def get_queryset(self):
        queryset = Listing.objects.select_related("seller", "category").prefetch_related(
            "photos", "variants"
        )
        # What a moderator is asked to decide on. `?status=` narrows it to one
        # bucket so the screen can show "needs review" and "rejected" tabs.
        if (wanted := self.request.query_params.get("status")) in dict(
            Listing.Status.choices
        ):
            queryset = queryset.filter(status=wanted)
        else:
            queryset = queryset.filter(status__in=WAITING)
        return queryset.order_by("-created_at")

    @action(detail=True, methods=["post"], url_path="decide")
    def decide(self, request, slug=None):
        """AI-11: a moderator confirms or reverses the AI result."""
        listing = self.get_object()
        decision = (request.data.get("decision") or "").strip().lower()
        note = (request.data.get("note") or "").strip()

        if decision not in ("approve", "reject"):
            return Response(
                {"decision": "Send 'approve' or 'reject'."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if decision == "reject" and not note:
            return Response(
                {"note": "A reason is required when rejecting a listing."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        previous = listing.status
        log = (
            ScreeningLog.objects.filter(
                content_type=ScreeningLog.ContentType.LISTING, object_id=listing.pk
            )
            .order_by("-created_at")
            .first()
        )

        if decision == "approve":
            listing.status = Listing.Status.APPROVED
            listing.rejection_reason = ""
            if listing.published_at is None:
                listing.published_at = timezone.now()
        else:
            listing.status = Listing.Status.REJECTED
            listing.rejection_reason = note
        listing.save(
            update_fields=["status", "rejection_reason", "published_at", "updated_at"]
        )

        if log is not None:
            ModerationDecision.objects.update_or_create(
                log=log,
                defaults={
                    "moderator": request.user,
                    "decision": (
                        ModerationDecision.Decision.REVERSED
                        if previous == Listing.Status.REJECTED and decision == "approve"
                        else ModerationDecision.Decision.CONFIRMED
                    ),
                    "final_outcome": (
                        services.APPROVED if decision == "approve" else services.REJECTED
                    ),
                    "note": note,
                },
            )

        return Response(self.get_serializer(listing).data)


class ScreeningLogViewSet(viewsets.ReadOnlyModelViewSet):
    """AI-08 and AI-15: the record moderators and the team can inspect."""

    serializer_class = ScreeningLogSerializer
    permission_classes = [IsModerator]

    def get_queryset(self):
        queryset = ScreeningLog.objects.select_related("decision__moderator")
        params = self.request.query_params
        if outcome := params.get("outcome"):
            queryset = queryset.filter(outcome=outcome)
        if params.get("type"):
            queryset = queryset.filter(content_type=params["type"])
        if (object_id := params.get("object_id")) and object_id.isdigit():
            queryset = queryset.filter(object_id=int(object_id))
        if params.get("disagreed") in ("1", "true", "yes"):
            # AI-15: the rows where a moderator overruled the AI, which is what
            # measuring accuracy actually needs.
            disagreed = [
                log_id
                for log_id, final, ai in ScreeningLog.objects.filter(
                    decision__isnull=False
                ).values_list("id", "decision__final_outcome", "outcome")
                if final != ai
            ]
            queryset = queryset.filter(id__in=disagreed)
        return queryset
