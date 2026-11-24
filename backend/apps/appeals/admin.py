from django.contrib import admin

from .models import Appeal


@admin.register(Appeal)
class AppealAdmin(admin.ModelAdmin):
    list_display = ("id", "kind", "status", "appellant", "decided_by", "created_at")
    list_filter = ("kind", "status")
    search_fields = ("reason", "appellant__email", "appellant__display_name")
    readonly_fields = ("created_at",)
