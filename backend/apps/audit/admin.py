from django.contrib import admin

from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "actor", "action", "target_type", "target_name")
    list_filter = ("action", "target_type")
    search_fields = ("target_name", "note", "actor__email")
    raw_id_fields = ("actor",)
    readonly_fields = ("actor", "action", "target_type", "target_id", "target_name", "note", "created_at")

    def has_add_permission(self, request):
        return False
