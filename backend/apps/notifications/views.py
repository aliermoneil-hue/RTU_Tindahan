"""Notifications API.

    GET  /api/v1/notifications/          the caller's inbox, newest first
    GET  /api/v1/notifications/?unread=1 unread only
    POST /api/v1/notifications/read/     {"all": true} or {"ids": [1, 2]}
    POST /api/v1/notifications/<id>/read/

The inbox is private by construction: the queryset is filtered to the caller.
"""

from django.utils import timezone
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import IsVerifiedUser

from .models import Notification
from .serializers import MarkReadSerializer, NotificationSerializer


class NotificationViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsVerifiedUser]
    pagination_class = None

    def get_queryset(self):
        queryset = Notification.objects.filter(user=self.request.user).select_related("actor")
        if self.request.query_params.get("unread") in {"1", "true", "yes"}:
            queryset = queryset.filter(read_at__isnull=True)
        return queryset

    @action(detail=False, methods=["post"])
    def read(self, request):
        payload = MarkReadSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        queryset = Notification.objects.filter(user=request.user, read_at__isnull=True)
        if not payload.validated_data.get("all"):
            queryset = queryset.filter(pk__in=payload.validated_data["ids"])
        updated = queryset.update(read_at=timezone.now())
        return Response({"marked": updated})

    @action(detail=True, methods=["post"])
    def read_one(self, request, pk=None):
        notification = self.get_object()
        if notification.read_at is None:
            notification.read_at = timezone.now()
            notification.save(update_fields=["read_at"])
        return Response(NotificationSerializer(notification).data)
