"""Official Store API.

These views are thin: every stock rule lives in `apps/store/services.py`, so
the HTTP layer only checks who is allowed to call what and converts errors.

    GET    /api/v1/store/tickets/                 your tickets (staff: all)
    POST   /api/v1/store/tickets/                 verified members
    GET    /api/v1/store/tickets/<reference>/     your ticket (staff: any)
    POST   /api/v1/store/tickets/<reference>/transition/   staff; students may cancel
    GET    /api/v1/store/stock/                   Office Staff only
    POST   /api/v1/store/stock-in/                Office Staff only
    POST   /api/v1/store/sales/                   Office Staff only (walk-in)
    GET    /api/v1/store/daily-counts/            Office Staff only
    POST   /api/v1/store/daily-counts/            Office Staff only
    GET    /api/v1/store/settings/                public
    PATCH  /api/v1/store/settings/                Office Staff only
"""

import json

from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsOfficeStaff, IsVerifiedUser
from apps.catalog.serializers import ListingVariantSerializer

from .models import (
    DailyCount,
    EmailOutbox,
    OfficialTicket,
    StockMovement,
    StoreSetting,
)
from .serializers import (
    DailyCountCreateSerializer,
    DailyCountSerializer,
    EmailOutboxSerializer,
    OfficialTicketCreateSerializer,
    OfficialTicketSerializer,
    StockInSerializer,
    StockMovementSerializer,
    StoreSettingSerializer,
    WalkInSaleSerializer,
    TicketTransitionSerializer,
    details,
)
from .services import (
    change_ticket_status,
    record_daily_count,
    record_stock_in,
    record_walk_in_sale,
    resolve_walk_in_buyer,
)


class OfficialTicketViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    lookup_field = "reference"

    def get_queryset(self):
        queryset = OfficialTicket.objects.select_related(
            "buyer", "processed_by"
        ).prefetch_related(
            "items__listing", "items__variant", "status_history__changed_by"
        )
        user = self.request.user
        if user.is_office_staff:
            queryset = queryset.all()
        else:
            queryset = queryset.filter(buyer=user)

        if ticket_status := self.request.query_params.get("status"):
            queryset = queryset.filter(status=ticket_status)
        return queryset

    def get_serializer_class(self):
        if self.action == "create":
            return OfficialTicketCreateSerializer
        return OfficialTicketSerializer

    def get_permissions(self):
        if self.action == "create":
            return [IsVerifiedUser()]
        return [IsAuthenticated()]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ticket = serializer.save()
        return Response(
            OfficialTicketSerializer(ticket, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @staticmethod
    def _may_cancel(ticket) -> bool:
        """A student may cancel, but only from a status the store allows."""
        return ticket.status in StoreSetting.get_solo().cancel_from

    @action(detail=True, methods=["post"])
    def transition(self, request, reference=None):
        """Move a ticket along the status graph (staff), or cancel it (buyer)."""
        ticket = self.get_object()
        serializer = TicketTransitionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_status = serializer.validated_data["status"]
        note = serializer.validated_data["note"]

        if not request.user.is_office_staff:
            if new_status != OfficialTicket.Status.CANCELLED:
                raise PermissionDenied("Only Office Staff may change this status.")
            if not self._may_cancel(ticket):
                raise PermissionDenied("This request can no longer be cancelled.")

        try:
            ticket = change_ticket_status(
                ticket, new_status, by=request.user, note=note
            )
        except DjangoValidationError as exc:
            raise serializers.ValidationError(details(exc))

        ticket.refresh_from_db()
        return Response(
            OfficialTicketSerializer(ticket, context={"request": request}).data
        )


class StockLedgerViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = StockMovementSerializer
    permission_classes = [IsOfficeStaff]

    def get_queryset(self):
        queryset = StockMovement.objects.select_related(
            "variant__listing", "created_by", "ticket"
        )
        if variant := self.request.query_params.get("variant"):
            queryset = queryset.filter(variant_id=variant)
        return queryset


class StockInView(APIView):
    permission_classes = [IsOfficeStaff]

    def post(self, request):
        serializer = StockInSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            movement = record_stock_in(
                data["variant"],
                data["quantity"],
                by=request.user,
                reason=data["reason"] or "New stock received",
            )
        except DjangoValidationError as exc:
            raise serializers.ValidationError(details(exc))

        variant = data["variant"]
        variant.refresh_from_db()
        return Response(
            {
                "movement": StockMovementSerializer(movement).data,
                "variant": ListingVariantSerializer(variant).data,
            },
            status=status.HTTP_201_CREATED,
        )


class WalkInSaleView(APIView):
    """POST /store/sales/ — a face-to-face sale at the store window.

    No student account is needed: the buyer pays at the window, the cashier
    records the units, and the ledger carries the sale. On-hand and available
    both drop, and the listing's sold counter moves, so "best-selling" stays
    honest. A failure anywhere rolls the whole sale back.
    """

    permission_classes = [IsOfficeStaff]

    def post(self, request):
        serializer = WalkInSaleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            buyer = resolve_walk_in_buyer(data.get("buyer", ""))
            movements = record_walk_in_sale(
                [(item["variant"], item["quantity"]) for item in data["items"]],
                by=request.user,
                reason=data["reason"] or "Walk-in sale",
                buyer=buyer,
            )
        except DjangoValidationError as exc:
            raise serializers.ValidationError(details(exc))

        variants = [movement.variant for movement in movements]
        return Response(
            {
                "movements": StockMovementSerializer(movements, many=True).data,
                "variants": ListingVariantSerializer(variants, many=True).data,
            },
            status=status.HTTP_201_CREATED,
        )


class DailyCountViewSet(
    mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet
):
    permission_classes = [IsOfficeStaff]

    def get_queryset(self):
        return DailyCount.objects.select_related("variant__listing", "counted_by")

    def get_serializer_class(self):
        if self.action == "create":
            return DailyCountCreateSerializer
        return DailyCountSerializer

    def create(self, request, *args, **kwargs):
        serializer = DailyCountCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            count = record_daily_count(
                data["variant"],
                data["counted_quantity"],
                by=request.user,
                reason=data.get("reason", ""),
                counted_on=data.get("counted_on"),
            )
        except DjangoValidationError as exc:
            raise serializers.ValidationError(details(exc))

        return Response(DailyCountSerializer(count).data, status=status.HTTP_201_CREATED)


class StoreSettingView(APIView):
    """Anyone may read the policy; only Office Staff may change it."""

    def get_permissions(self):
        if self.request.method in {"PATCH", "PUT"}:
            return [IsOfficeStaff()]
        return [AllowAny()]

    def get(self, request):
        return Response(StoreSettingSerializer(StoreSetting.get_solo()).data)

    def patch(self, request):
        setting = StoreSetting.get_solo()
        serializer = StoreSettingSerializer(setting, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save(updated_by=request.user)
        return Response(serializer.data)


class EmailOutboxViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """EM-06: the staff read what the store prepared, and export it.

    Read-only on purpose. A message in here is a draft that EM-05 keeps from
    being sent; letting a screen edit or delete one would turn a record into an
    opinion. The export is the same rows as a file, for whoever wants to look at
    them outside the panel.
    """

    serializer_class = EmailOutboxSerializer
    permission_classes = [IsOfficeStaff]

    def get_queryset(self):
        queryset = EmailOutbox.objects.select_related("ticket")
        params = self.request.query_params
        if kind := params.get("kind"):
            queryset = queryset.filter(kind=kind)
        if state := params.get("state"):
            queryset = queryset.filter(state=state)
        if event := params.get("event"):
            queryset = queryset.filter(event=event)
        return queryset

    @action(detail=False, methods=["get"], url_path="export")
    def export(self, request):
        rows = self.get_queryset().order_by("-created_at")
        payload = EmailOutboxSerializer(rows, many=True).data
        body = json.dumps(
            {"exported_at": timezone.now().isoformat(), "count": len(payload), "messages": payload},
            indent=2,
            default=str,
        )
        response = HttpResponse(body, content_type="application/json")
        response["Content-Disposition"] = (
            f'attachment; filename="tindahan-outbox-{timezone.localdate():%Y%m%d}.json"'
        )
        return response
