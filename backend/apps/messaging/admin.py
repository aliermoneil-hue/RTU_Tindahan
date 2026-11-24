from django.contrib import admin

from .models import ConversationReport


@admin.register(ConversationReport)
class ConversationReportAdmin(admin.ModelAdmin):
    list_display = ("id", "reason", "status", "action", "reporter", "reported_user", "created_at")
    list_filter = ("status", "action", "reason")
    search_fields = ("details", "snapshot_body", "reporter__email", "reported_user__email")
    readonly_fields = ("snapshot_body", "snapshot_at", "created_at")
