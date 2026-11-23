from django.db.models import Q
from django.utils import timezone
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.notifications.services import notify

from .models import Conversation, Message
from .serializers import (
    ConversationOpenSerializer,
    ConversationSerializer,
    MessageCreateSerializer,
    MessageSerializer,
    touch,
)


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
