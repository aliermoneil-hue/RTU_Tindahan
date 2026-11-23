"""Staff-facing account management: the Users and audit screen.

    GET  /api/v1/admin/users/                staff only; ?q= ?role= ?status=
    GET  /api/v1/admin/users/<id>/           staff only
    POST /api/v1/admin/users/<id>/status/    administrators only
    POST /api/v1/admin/users/<id>/role/      administrators only

Suspending or banning deletes the account's token, so the session ends now
rather than at the next request, and their listings stop appearing in the
catalogue (the catalogue filters inactive sellers). Restoring access notifies
the member. Every write lands in the audit log.
"""

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import serializers, status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.audit.services import record
from apps.notifications.services import notify

from .models import User
from .permissions import IsAdministrator, IsModerator

STAFF_ROLES = {User.Role.OFFICE_STAFF, User.Role.MODERATOR, User.Role.ADMINISTRATOR}


class AdminUserSerializer(serializers.ModelSerializer):
    college_name = serializers.CharField(source="college.name", read_only=True, default=None)
    college_code = serializers.CharField(source="college.code", read_only=True, default=None)
    status_changed_by_name = serializers.SerializerMethodField()
    is_verified = serializers.BooleanField(read_only=True)
    listing_count = serializers.IntegerField(read_only=True)
    order_count = serializers.IntegerField(read_only=True)
    forum_post_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "display_name",
            "role",
            "member_type",
            "college_name",
            "college_code",
            "year_level",
            "status",
            "status_note",
            "status_changed_at",
            "status_changed_by_name",
            "is_verified",
            "verified_at",
            "date_joined",
            "listing_count",
            "order_count",
            "forum_post_count",
        )
        read_only_fields = fields

    def get_status_changed_by_name(self, obj):
        if not obj.status_changed_by_id:
            return None
        name = (obj.status_changed_by.display_name or obj.status_changed_by.email or "").strip()
        return name.split(" ")[0] if name else "Staff"


class AdminStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=User.Status.choices)
    note = serializers.CharField(max_length=200, required=False, allow_blank=True)


class AdminRoleSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=User.Role.choices)


class AdminUserViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AdminUserSerializer
    permission_classes = [IsModerator]

    def get_permissions(self):
        # The actions are routed by hand in accounts/urls.py, which does not
        # carry the decorator's permission_classes; decide here instead.
        if self.action in {"status", "role"}:
            return [IsAdministrator()]
        return [IsModerator()]

    def get_queryset(self):
        queryset = User.objects.select_related("college", "status_changed_by").annotate(
            listing_count=Count("listings", distinct=True),
            order_count=Count("orders_placed", distinct=True),
            forum_post_count=Count("forum_posts", distinct=True),
        )
        params = self.request.query_params
        if params.get("q"):
            term = params["q"]
            queryset = queryset.filter(
                Q(email__icontains=term) | Q(display_name__icontains=term)
            )
        if params.get("role"):
            queryset = queryset.filter(role=params["role"])
        if params.get("status"):
            queryset = queryset.filter(status=params["status"])
        return queryset.order_by("-date_joined")

    @action(detail=True, methods=["post"], permission_classes=[IsAdministrator])
    def status(self, request, pk=None):
        target = self.get_object()
        payload = AdminStatusSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        new_status = payload.validated_data["status"]
        note = (payload.validated_data.get("note") or "").strip()

        if target.pk == request.user.pk:
            return Response(
                {"detail": ["You cannot change your own account status."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if target.role in STAFF_ROLES:
            return Response(
                {"detail": ["Staff accounts cannot be suspended or banned here."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if new_status != User.Status.ACTIVE and len(note) < 5:
            return Response(
                {"detail": ["Write a short reason (at least 5 characters)."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        previous = target.status
        target.status = new_status
        target.status_note = note
        target.status_changed_at = timezone.now()
        target.status_changed_by = request.user
        target.save(
            update_fields=[
                "status",
                "status_note",
                "status_changed_at",
                "status_changed_by",
            ]
        )

        if new_status in {User.Status.SUSPENDED, User.Status.BANNED}:
            # End the session now, not at the next request.
            Token.objects.filter(user=target).delete()
        else:
            notify(
                target,
                "Your account access was restored. Welcome back.",
                kind="system",
                actor=request.user,
            )

        action_name = {
            User.Status.ACTIVE: "restore user",
            User.Status.SUSPENDED: "suspend user",
            User.Status.BANNED: "ban user",
        }[new_status]
        record(
            request.user,
            action_name,
            target_type="user",
            target_id=target.email,
            target_name=target.display_name,
            note=note or f"was {previous}",
        )
        return Response(
            AdminUserSerializer(
                self.get_queryset().get(pk=target.pk), context=self.get_serializer_context()
            ).data
        )

    @action(detail=True, methods=["post"], permission_classes=[IsAdministrator])
    def role(self, request, pk=None):
        target = self.get_object()
        payload = AdminRoleSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        new_role = payload.validated_data["role"]

        if target.pk == request.user.pk:
            return Response(
                {"detail": ["You cannot change your own role."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if (
            target.role == User.Role.ADMINISTRATOR
            and new_role != User.Role.ADMINISTRATOR
            and User.objects.filter(role=User.Role.ADMINISTRATOR).count() <= 1
        ):
            return Response(
                {"detail": ["At least one administrator must remain."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        previous = target.role
        target.role = new_role
        target.save(update_fields=["role"])
        record(
            request.user,
            "change role",
            target_type="user",
            target_id=target.email,
            target_name=target.display_name,
            note=f"{previous} -> {new_role}",
        )
        return Response(
            AdminUserSerializer(
                self.get_queryset().get(pk=target.pk), context=self.get_serializer_context()
            ).data
        )
