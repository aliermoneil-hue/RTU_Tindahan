from rest_framework import serializers

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    read = serializers.BooleanField(source="is_read", read_only=True)
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = (
            "id",
            "kind",
            "text",
            "link_kind",
            "link_id",
            "read",
            "read_at",
            "actor_name",
            "created_at",
        )
        read_only_fields = fields

    def get_actor_name(self, obj):
        if not obj.actor_id:
            return None
        name = (obj.actor.display_name or obj.actor.email or "").strip()
        return name.split(" ")[0] if name else "Member"


class MarkReadSerializer(serializers.Serializer):
    ids = serializers.ListField(child=serializers.IntegerField(), required=False, default=list)
    all = serializers.BooleanField(required=False, default=False)

    def validate(self, attrs):
        if not attrs.get("all") and not attrs.get("ids"):
            raise serializers.ValidationError("Send `ids` or `all`.")
        return attrs
