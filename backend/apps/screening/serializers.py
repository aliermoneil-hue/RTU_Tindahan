from rest_framework import serializers

from .models import ModerationDecision, ScreeningLog


class ModerationDecisionSerializer(serializers.ModelSerializer):
    moderator_name = serializers.CharField(
        source="moderator.display_name", read_only=True, default=None
    )

    class Meta:
        model = ModerationDecision
        fields = (
            "id",
            "decision",
            "final_outcome",
            "note",
            "moderator_name",
            "created_at",
            "agreed_with_ai",
        )
        read_only_fields = fields


class ScreeningLogSerializer(serializers.ModelSerializer):
    """AI-08 and AI-15: the AI verdict next to the human decision."""

    decision = ModerationDecisionSerializer(read_only=True)
    content_type_label = serializers.CharField(
        source="get_content_type_display", read_only=True
    )

    class Meta:
        model = ScreeningLog
        fields = (
            "id",
            "content_type",
            "content_type_label",
            "object_id",
            "cleaned_text",
            "outcome",
            "reason",
            "confidence",
            "provider",
            "rules_version",
            "created_at",
            "decision",
        )
        read_only_fields = fields
