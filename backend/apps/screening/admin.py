"""Screening results are an audit trail: readable, never editable."""

from django.contrib import admin

from .models import ScreeningResult


@admin.register(ScreeningResult)
class ScreeningResultAdmin(admin.ModelAdmin):
    list_display = ("listing", "verdict", "score", "provider", "created_at")
    list_filter = ("verdict", "provider")
    search_fields = ("listing__title", "listing__slug")
    date_hierarchy = "created_at"
    readonly_fields = (
        "listing",
        "verdict",
        "score",
        "reasons",
        "provider",
        "model_name",
        "raw",
        "created_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
