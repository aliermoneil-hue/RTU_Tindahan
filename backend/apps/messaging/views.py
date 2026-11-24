from django.db.models import Q
from django.utils import timezone
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.notifications.services import notify

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import PermissionDenied, ValidationError

from .models import Conversation, ConversationReport, Message
from .serializers import (
    ConversationOpenSerializer,
    ConversationReportCreateSerializer,
    ConversationReportResolveSerializer,
    ConversationReportSerializer,
    ConversationSerializer,
    MessageCreateSerializer,
    MessageSerializer,
    touch,
)
from .services import report_conversation, resolve_report


class ConversationViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Conversation.objects.none()
        return (
            Conversation.objects.filter(Q(buyer=user) | Q(seller=user))
            .select_related("buyer", "seller", "listing")
            .prefetch_related("messages__sender")
        )

    def get_serializer_class(self):
        if self.action == "create":
            return ConversationOpenSerializer
        return ConversationSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        conversation = serializer.save()
        return Response(
            ConversationSerializer(
                conversation, context=self.get_serializer_context()
            ).data,
            status=status.HTTP_201_CREATED,
        )

    def _is_participant(self, conversation, user):
        return user.pk in {conversation.buyer_id, conversation.seller_id}

    @action(detail=True, methods=["post"])
    def messages(self, request, pk=None):
        conversation = self.get_object()
        serializer = MessageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = Message.objects.create(
            conversation=conversation,
            sender=request.user,
            body=serializer.validated_data["body"],
        )
        touch(conversation)
        recipient = (
            conversation.seller
            if request.user.pk == conversation.buyer_id
            else conversation.buyer
        )
        notify(
            recipient,
            f"New message from {request.user.display_name}.",
            kind="message",
            link_kind="message",
            link_id=f"cv-{conversation.pk}",
            actor=request.user,
        )
        return Response(MessageSerializer(message).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def report(self, request, pk=None):
        """MS-04: a participant reports the thread, or one message in it."""
        conversation = self.get_object()
        serializer = ConversationReportCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        message = None
        if data.get("message"):
            message = Message.objects.filter(
                pk=data["message"], conversation=conversation
            ).first()
            if message is None:
                raise ValidationError({"message": "That message is not in this conversation."})
        try:
            report = report_conversation(
                reporter=request.user,
                conversation=conversation,
                reason=data["reason"],
                details=data.get("details", ""),
                message=message,
            )
        except DjangoValidationError as exc:
            raise ValidationError(exc.messages)
        return Response(
            ConversationReportSerializer(
                report, context=self.get_serializer_context()
            ).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def read(self, request, pk=None):
        conversation = self.get_object()
        Message.objects.filter(
            conversation=conversation, read_at__isnull=True
        ).exclude(sender=request.user).update(read_at=timezone.now())
        return Response(
            ConversationSerializer(
                conversation, context=self.get_serializer_context()
            ).data
        )


class ConversationReportViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """MS-05's queue: staff see every open report; a member sees the ones they filed.

    The row never carries the thread. `reported_messages` holds the message the
    report is about and nothing else, which is what makes it safe for a
    moderator to read.
    """

    serializer_class = ConversationReportSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = ConversationReport.objects.select_related(
            "reporter", "reported_user", "handled_by", "conversation", "message"
        )
        if not user.is_authenticated:
            return queryset.none()
        if not user.is_moderator:
            queryset = queryset.filter(reporter=user)
        if wanted := self.request.query_params.get("status"):
            from apps.forum.report_status import LEGACY_RESOLUTION, normalize_status

            queryset = queryset.filter(status=normalize_status(wanted))
            if legacy := LEGACY_RESOLUTION.get(wanted):
                queryset = queryset.filter(resolution=legacy)
        if resolution := self.request.query_params.get("resolution"):
            queryset = queryset.filter(resolution=resolution)
        return queryset

    @action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        if not request.user.is_moderator:
            raise PermissionDenied("Only a moderator or an administrator handles a report.")
        report = self.get_object()
        serializer = ConversationReportResolveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            report = resolve_report(
                report=report,
                by=request.user,
                action=serializer.validated_data["action"],
                note=serializer.validated_data.get("note", ""),
            )
        except DjangoValidationError as exc:
            raise ValidationError(exc.messages)
        return Response(
            ConversationReportSerializer(
                report, context=self.get_serializer_context()
            ).data
        )
