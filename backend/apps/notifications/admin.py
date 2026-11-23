from django.contrib import admin

from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("user", "kind", "text", "link_kind", "read_at", "created_at")
    list_filter = ("kind", "read_at", "link_kind")
    search_fields = ("user__email", "text")
    raw_id_fields = ("user", "actor")
