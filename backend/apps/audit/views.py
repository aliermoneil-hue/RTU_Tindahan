"""Audit log API.

    GET /api/v1/admin/audit/     staff only; ?action= ?target_type= ?q=
"""

from django.db.models import Q
from rest_framework import generics

from apps.accounts.permissions import IsModerator

from .models import AuditLog
from .serializers import AuditLogSerializer


class AuditLogListView(generics.ListAPIView):
    serializer_class = AuditLogSerializer
    permission_classes = [IsModerator]

    def get_queryset(self):
        queryset = AuditLog.objects.select_related("actor")
        params = self.request.query_params
        if params.get("action"):
            queryset = queryset.filter(action=params["action"])
        if params.get("target_type"):
            queryset = queryset.filter(target_type=params["target_type"])
        if params.get("q"):
            term = params["q"]
            queryset = queryset.filter(
                Q(target_name__icontains=term) | Q(note__icontains=term)
            )
        return queryset
