


from rest_framework import serializers  # noqa: E402


class ScreeningRuleSerializer(serializers.ModelSerializer):
    kind_display = serializers.CharField(source="get_kind_display", read_only=True)
    added_by = serializers.SerializerMethodField()

    class Meta:
        from .models import ScreeningRule

        model = ScreeningRule
        fields = (
            "id",
            "phrase",
            "kind",
            "kind_display",
            "note",
            "is_active",
            "added_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "added_by", "created_at", "updated_at")

    def get_added_by(self, obj):
        return obj.created_by.display_name if obj.created_by_id else ""

    def validate_phrase(self, value):
        phrase = (value or "").strip().lower()
        if len(phrase) < 2:
            raise serializers.ValidationError("A phrase needs at least two characters.")
        return phrase
