import csv
from datetime import date

from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsVerifiedUser

from .models import Order
from .serializers import (
    OrderCreateSerializer,
    OrderPaymentSerializer,
    OrderSerializer,
    OrderTransitionSerializer,
    details,
)
from .services import (
    change_order_status,
    confirm_handover,
    expire_overdue_requests,
    set_payment_method,
)


class OrderViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    lookup_field = "reference"

    def get_queryset(self):
        # OT-12: sweep before answering, so a lapsed request is never shown as
        # if it were still waiting. Cheap: one indexed query on an empty set.
        if self.action in ("list", "retrieve", "export"):
            expire_overdue_requests()
        user = self.request.user
        queryset = Order.objects.select_related("buyer", "seller").prefetch_related(
            "lines"
        )
        if not user.is_authenticated:
            return queryset.none()

        # Bought and sold both show up in "my orders"; the client says which it
        # wants with ?role=seller or ?role=buyer.
        role = self.request.query_params.get("role")
        if role == "seller":
            queryset = queryset.filter(seller=user)
        elif role == "buyer":
            queryset = queryset.filter(buyer=user)
        else:
            from django.db.models import Q

            queryset = queryset.filter(Q(buyer=user) | Q(seller=user))

        if order_status := self.request.query_params.get("status"):
            queryset = queryset.filter(status=order_status)

        # SD-03: a seller narrows their own sales history by date range.
        date_from = self._date_param("from")
        date_to = self._date_param("to")
        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)
        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)
        return queryset

    def _date_param(self, name):
        raw = (self.request.query_params.get(name) or "").strip()
        if not raw:
            return None
        parsed = parse_date(raw)
        if parsed is None:
            raise ValidationError({name: "Use YYYY-MM-DD."})
        return parsed

    def get_serializer_class(self):
        if self.action == "create":
            return OrderCreateSerializer
        return OrderSerializer

    def get_permissions(self):
        if self.action == "create":
            return [IsVerifiedUser()]
        return [IsAuthenticated()]

    @action(detail=False, methods=["get"], url_path="export")
    def export(self, request):
        """SD-04: a member downloads their own records as a structured file.

        The staff ledger has exported CSV for a while; a seller had no way to
        take their own numbers away. This uses the same queryset as the list, so
        it can never widen the scope: `?role=seller` is the default here, the
        date and status filters apply, and a member can only ever export rows
        they are party to.
        """
        role = (request.query_params.get("role") or "seller").strip()
        if role not in ("seller", "buyer"):
            role = "seller"
        # get_queryset reads the role from query_params; make the default stick.
        if not request.query_params.get("role"):
            request.query_params._mutable = True
            request.query_params["role"] = role
            request.query_params._mutable = False

        orders = self.get_queryset().order_by("-created_at")

        stamp = timezone.localdate().strftime("%Y%m%d")
        filename = f"tindahan-{role}-sales-{stamp}.csv"
        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'

        writer = csv.writer(response)
        writer.writerow(
            [
                "reference",
                "placed_on",
                "status",
                "buyer",
                "buyer_email",
                "items",
                "total",
                "meetup_place",
                "completed_on",
            ]
        )
        for order in orders:
            lines = "; ".join(
                f"{line.title} x{line.quantity}" for line in order.lines.all()
            )
            writer.writerow(
                [
                    _cell(order.reference),
                    _cell(timezone.localtime(order.created_at).strftime("%Y-%m-%d %H:%M")),
                    _cell(order.status),
                    _cell(order.buyer.display_name if order.buyer else ""),
                    _cell(order.buyer.email if order.buyer else ""),
                    _cell(lines),
                    _cell(f"{order.total_amount:.2f}"),
                    _cell(order.meetup_place),
                    _cell(
                        timezone.localtime(order.updated_at).strftime("%Y-%m-%d %H:%M")
                        if order.status == Order.Status.COMPLETED
                        else ""
                    ),
                ]
            )
        return response

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = serializer.save()
        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def payment(self, request, reference=None):
        """OT-06: either party records how the money will move. Nothing else."""
        order = self.get_object()
        serializer = OrderPaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            order = set_payment_method(
                order, serializer.validated_data["method"], by=request.user
            )
        except DjangoValidationError as exc:
            raise serializers.ValidationError(details(exc))
        return Response(OrderSerializer(order, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"])
    def confirm(self, request, reference=None):
        """OT-10: this side says the meet-up happened. Both sides make it final."""
        order = self.get_object()
        try:
            order = confirm_handover(order, by=request.user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(details(exc))
        return Response(OrderSerializer(order, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"])
    def transition(self, request, reference=None):
        order = self.get_object()
        serializer = OrderTransitionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            order = change_order_status(
                order, serializer.validated_data["status"], by=request.user
            )
        except DjangoValidationError as exc:
            raise serializers.ValidationError(details(exc))
        return Response(OrderSerializer(order).data)


def _cell(value):
    """A spreadsheet must not run what a member typed.

    A title of `=HYPERLINK(...)` is a formula the moment the file opens, so any
    cell that starts with one of the formula characters is prefixed with a quote
    and read as text.
    """
    text = "" if value is None else str(value)
    if text[:1] in ("=", "+", "-", "@"):
        return "'" + text
    return text
