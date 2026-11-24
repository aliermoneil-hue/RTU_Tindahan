from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.accounts.permissions import IsVerifiedUser
from apps.catalog.models import Listing
from apps.forum.models import ForumComment, ForumPost

from .models import Appeal
from .serializers import AppealCreateSerializer, AppealDecideSerializer, AppealSerializer
from .services import decide_appeal, open_appeal


class AppealViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """A member files and reads their own appeals; staff read the queue and decide."""

    serializer_class = AppealSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = Appeal.objects.select_related(
            "appellant", "original_decider", "decided_by", "listing", "post", "comment"
        )
        if not user.is_authenticated:
            return queryset.none()
        if not user.is_moderator:
            queryset = queryset.filter(appellant=user)
        if wanted := self.request.query_params.get("status"):
            queryset = queryset.filter(status=wanted)
        return queryset

    def get_permissions(self):
        if self.action == "create":
            return [IsVerifiedUser()]
        return [IsAuthenticated()]

    def create(self, request, *args, **kwargs):
        serializer = AppealCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        def pick(model, key):
            value = data.get(key)
            if not value:
                return None
            try:
                return model.objects.get(pk=value)
            except model.DoesNotExist:
                raise ValidationError({key: "That record no longer exists."})

        try:
            appeal = open_appeal(
                appellant=request.user,
                kind=data["kind"],
                reason=data["reason"],
                listing=pick(Listing, "listing"),
                post=pick(ForumPost, "post"),
                comment=pick(ForumComment, "comment"),
            )
        except DjangoValidationError as exc:
            raise ValidationError(exc.messages)
        return Response(
            AppealSerializer(appeal, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def decide(self, request, pk=None):
        if not request.user.is_moderator:
            raise PermissionDenied("Only a moderator or an administrator reviews an appeal.")
        appeal = self.get_object()
        serializer = AppealDecideSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            appeal = decide_appeal(
                appeal=appeal,
                by=request.user,
                grant=serializer.validated_data["grant"],
                note=serializer.validated_data["note"],
            )
        except DjangoValidationError as exc:
            raise ValidationError(exc.messages)
        return Response(AppealSerializer(appeal, context=self.get_serializer_context()).data)


class SuspensionAppealPayload(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(max_length=128, trim_whitespace=False)
    reason = serializers.CharField(max_length=1000, trim_whitespace=True)


class SuspensionAppealView(APIView):
    """RM-08 from the outside: a suspended account cannot sign in to appeal.

    Sign-in refuses a suspended account, which would otherwise make the
    suspension unappealable — the very gap RM-08 names. So this one endpoint
    takes the credentials the person already has, checks them the same way the
    sign-in does, and files the appeal without issuing a token. A wrong password
    and an unknown address answer identically, and the endpoint is throttled per
    client so it cannot be used to guess.
    """

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "suspension-appeal"

    def post(self, request):
        serializer = SuspensionAppealPayload(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].strip().lower()
        password = serializer.validated_data["password"]
        reason = serializer.validated_data["reason"]

        from apps.accounts.models import User

        user = User.objects.filter(email__iexact=email).first()
        if user is None or not user.check_password(password):
            return Response(
                {"detail": "That email address and password do not match."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if user.status == User.Status.BANNED:
            return Response(
                {
                    "detail": (
                        "A banned account cannot be appealed from here. "
                        "Write to the Office of Student Affairs."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        if user.status != User.Status.SUSPENDED:
            return Response(
                {"detail": "That account is not suspended."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            appeal = open_appeal(appellant=user, kind=Appeal.Kind.ACCOUNT, reason=reason)
        except DjangoValidationError as exc:
            raise ValidationError(exc.messages)
        # Deliberately thin: enough to reassure, nothing to enumerate.
        return Response(
            {"id": appeal.pk, "status": appeal.status, "detail": "Your appeal was sent."},
            status=status.HTTP_201_CREATED,
        )
