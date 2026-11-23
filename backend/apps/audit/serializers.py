from rest_framework import serializers

from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()
    actor_email = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = (
            "id",
            "actor_email",
            "actor_name",
            "action",
            "target_type",
            "target_id",
            "target_name",
            "note",
            "created_at",
        )
        read_only_fields = fields

    def get_actor_name(self, obj):
        if obj.actor_id:
            name = (obj.actor.display_name or obj.actor.email or "").strip()
            return name.split(" ")[0] if name else "Staff"
        return "Former staff"

    def get_actor_email(self, obj):
        return obj.actor.email if obj.actor_id else ""
