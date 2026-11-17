from django.contrib import admin

from .models import ModerationDecision, ScreeningLog, ScreeningRule


@admin.register(ScreeningRule)
class ScreeningRuleAdmin(admin.ModelAdmin):
    """AI-10: an Administrator edits the rules here, not in the code."""

    list_display = ("term", "outcome", "is_active", "updated_by", "updated_at")
    list_filter = ("outcome", "is_active")
    search_fields = ("term",)
    readonly_fields = ("created_at", "updated_at")

    def save_model(self, request, obj, form, change):
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)


class ModerationDecisionInline(admin.StackedInline):
    model = ModerationDecision
    extra = 0
    readonly_fields = ("created_at",)


@admin.register(ScreeningLog)
class ScreeningLogAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "content_type",
        "object_id",
        "outcome",
        "confidence",
        "provider",
        "created_at",
    )
    list_filter = ("outcome", "content_type", "provider")
    search_fields = ("object_id", "cleaned_text", "reason")
    date_hierarchy = "created_at"
    inlines = [ModerationDecisionInline]
    readonly_fields = (
        "content_type",
        "object_id",
        "cleaned_text",
        "outcome",
        "reason",
        "confidence",
        "provider",
        "rules_version",
        "created_at",
    )


@admin.register(ModerationDecision)
class ModerationDecisionAdmin(admin.ModelAdmin):
    list_display = ("log", "decision", "final_outcome", "moderator", "created_at")
    list_filter = ("decision", "final_outcome")
    readonly_fields = ("created_at",)
