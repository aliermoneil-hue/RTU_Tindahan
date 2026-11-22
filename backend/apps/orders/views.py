from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsVerifiedUser

from .models import Order
from .serializers import (
    OrderCreateSerializer,
    OrderSerializer,
    OrderTransitionSerializer,
    details,
)
from .services import change_order_status


class OrderViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    lookup_field = "reference"

    def get_queryset(self):
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
        return queryset

    def get_serializer_class(self):
        if self.action == "create":
            return OrderCreateSerializer
        return OrderSerializer

    def get_permissions(self):
        if self.action == "create":
            return [IsVerifiedUser()]
        return [IsAuthenticated()]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = serializer.save()
        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)

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
