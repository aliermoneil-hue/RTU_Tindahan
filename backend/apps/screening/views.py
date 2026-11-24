"""AI-10: the administrator's list of screening terms, over HTTP."""

from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsAdministrator, IsModerator
from apps.audit.services import record

from .models import ScreeningRule
from .serializers import ScreeningRuleSerializer


class ScreeningRuleViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Reading is for moderators; changing the rules is an administrator's alone.

    Every write is audited with the before and after phrase, because the audit
    log is what a panel — or a complaint — gets read against.
    """

    serializer_class = ScreeningRuleSerializer
    lookup_field = "pk"
    # The list is a couple of dozen short phrases and the screen shows all of
    # them; paging it hid 30 of the 50 prohibited terms behind a page nobody
    # asked for.
    pagination_class = None

    def get_queryset(self):
        queryset = ScreeningRule.objects.all()
        if kind := self.request.query_params.get("kind"):
            queryset = queryset.filter(kind=kind)
        if active := self.request.query_params.get("active"):
            queryset = queryset.filter(is_active=active.lower() in ("1", "true", "yes"))
        return queryset

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAdministrator()]
        if self.action in ("list", "retrieve"):
            return [IsModerator()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        rule = serializer.save(created_by=self.request.user)
        record(
            self.request.user,
            "screening rule added",
            target_type="screening_rule",
            target_id=rule.pk,
            target_name=rule.phrase,
            note=rule.kind,
        )

    def perform_update(self, serializer):
        before = serializer.instance.phrase
        rule = serializer.save()
        record(
            self.request.user,
            "screening rule changed",
            target_type="screening_rule",
            target_id=rule.pk,
            target_name=rule.phrase,
            note=f"{before} -> {rule.phrase} ({rule.kind}, {'active' if rule.is_active else 'off'})",
        )

    def perform_destroy(self, instance):
        record(
            self.request.user,
            "screening rule removed",
            target_type="screening_rule",
            target_id=instance.pk,
            target_name=instance.phrase,
            note=instance.kind,
        )
        instance.delete()
