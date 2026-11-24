from rest_framework import serializers

from .models import Appeal


class AppealSerializer(serializers.ModelSerializer):
    appellant_name = serializers.SerializerMethodField()
    is_mine = serializers.SerializerMethodField()
    target_label = serializers.CharField(read_only=True)
    original_decider_name = serializers.SerializerMethodField()
    decided_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Appeal
        fields = (
            "id",
            "kind",
            "status",
            "reason",
            "target_label",
            "appellant_name",
            "is_mine",
            "original_decider_name",
            "decided_by_name",
            "decided_at",
            "decision_note",
            "created_at",
        )
        read_only_fields = fields

    def get_appellant_name(self, obj):
        return obj.appellant.display_name if obj.appellant_id else ""

    def get_is_mine(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        return bool(user and user.is_authenticated and user.pk == obj.appellant_id)

    def get_original_decider_name(self, obj):
        return obj.original_decider.display_name if obj.original_decider_id else ""

    def get_decided_by_name(self, obj):
        return obj.decided_by.display_name if obj.decided_by_id else ""


class AppealCreateSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=Appeal.Kind.choices)
    reason = serializers.CharField(max_length=1000, trim_whitespace=True)
    listing = serializers.IntegerField(required=False, allow_null=True)
    post = serializers.IntegerField(required=False, allow_null=True)
    comment = serializers.IntegerField(required=False, allow_null=True)


class AppealDecideSerializer(serializers.Serializer):
    grant = serializers.BooleanField()
    note = serializers.CharField(max_length=600, trim_whitespace=True, allow_blank=True)
