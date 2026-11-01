"""Serializers for the admin front end (AD-01: manage accounts and roles)."""

from django.utils import timezone
from rest_framework import serializers
from rest_framework.authtoken.models import Token

from .models import User
from .serializers import UserSerializer


class AdminUserSerializer(UserSerializer):
    """Everything the account screens need, including the status history."""

    class Meta(UserSerializer.Meta):
        # profile_photo is left out of the admin screens on purpose.
        fields = tuple(f for f in UserSerializer.Meta.fields if f != "profile_photo") + (
            "status_note",
            "status_changed_at",
            "verified_at",
            "is_active",
            "last_login",
        )
        read_only_fields = fields


class AdminUserUpdateSerializer(serializers.ModelSerializer):
    """AD-01: change a role, or suspend, ban, and reactivate an account."""

    class Meta:
        model = User
        fields = ("role", "status", "status_note")
        extra_kwargs = {"status_note": {"required": False, "allow_blank": True}}

    def validate(self, attrs):
        actor = self.context["request"].user
        user = self.instance

        new_role = attrs.get("role", user.role)
        new_status = attrs.get("status", user.status)
        role_changes = new_role != user.role
        status_changes = new_status != user.status

        # An administrator must not lock themselves out.
        if user.pk == actor.pk:
            if role_changes:
                raise serializers.ValidationError({"role": "You cannot change your own role."})
            if status_changes:
                raise serializers.ValidationError(
                    {"status": "You cannot change your own account status."}
                )

        # Keep at least one working administrator.
        loses_admin_access = user.role == User.Role.ADMINISTRATOR and (
            role_changes or new_status != User.Status.ACTIVE
        )
        if loses_admin_access:
            others = User.objects.filter(
                role=User.Role.ADMINISTRATOR,
                status=User.Status.ACTIVE,
                is_active=True,
            ).exclude(pk=user.pk)
            if not others.exists():
                raise serializers.ValidationError(
                    {"role": "At least one active administrator must remain."}
                )

        # Roles above Visitor are for verified accounts only (AV-03).
        if role_changes and new_role != User.Role.VISITOR and not user.is_verified:
            raise serializers.ValidationError(
                {"role": "Verify the account before giving it a role."}
            )

        # A suspension or ban needs a written reason for the record.
        if status_changes and new_status != User.Status.ACTIVE:
            note = (attrs.get("status_note") or "").strip()
            if not note:
                raise serializers.ValidationError(
                    {"status_note": "Write the reason for this action."}
                )
            attrs["status_note"] = note

        return attrs

    def update(self, instance, validated_data):
        status_changed = (
            "status" in validated_data and validated_data["status"] != instance.status
        )
        for field, value in validated_data.items():
            setattr(instance, field, value)

        if status_changed:
            instance.status_changed_at = timezone.now()
            if instance.status == User.Status.ACTIVE:
                instance.is_active = True
        instance.save()

        # A suspended or banned account loses its session straight away.
        if instance.status != User.Status.ACTIVE:
            Token.objects.filter(user=instance).delete()
        return instance
