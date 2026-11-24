from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils import timezone

from .models import LoginAttempt, User


def clear_selected_lockouts(modeladmin, request, queryset):
    """Staff action: clear failed-attempt records (unlock accounts)."""
    count = queryset.count()
    queryset.delete()
    modeladmin.message_user(
        request, f"Cleared {count} login attempt record(s)."
    )


clear_selected_lockouts.short_description = "Clear selected lockouts"


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ("-date_joined",)
    list_display = (
        "email",
        "display_name",
        "role",
        "member_type",
        "college",
        "status",
        "is_verified",
        "date_joined",
    )
    list_filter = ("role", "member_type", "status", "is_active", "is_staff")
    search_fields = ("email", "display_name", "college")

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        (
            "RTU identity",
            {
                "fields": (
                    "display_name",
                    "member_type",
                    "college",
                    "year_level",
                    "contact_number",
                    "profile_photo",
                )
            },
        ),
        (
            "Access",
            {
                "fields": (
                    "role",
                    "status",
                    "status_note",
                    "status_changed_at",
                    "verified_at",
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                )
            },
        ),
        ("Dates", {"fields": ("last_login", "date_joined")}),
    )

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "email",
                    "display_name",
                    "member_type",
                    "college",
                    "year_level",
                    "role",
                    "password1",
                    "password2",
                ),
            },
        ),
    )

    readonly_fields = ("date_joined", "last_login", "status_changed_at")


@admin.register(LoginAttempt)
class LoginAttemptAdmin(admin.ModelAdmin):
    """Read-only admin for login attempt records, with an unlock action."""

    list_display = (
        "email",
        "failed_count",
        "locked_until",
        "last_failed_at",
        "updated_at",
    )
    list_filter = ("locked_until", "updated_at")
    search_fields = ("email",)
    readonly_fields = ("email", "failed_count", "locked_until", "last_failed_at", "updated_at")
    actions = [clear_selected_lockouts]

    def has_add_permission(self, request):
        return False

    def is_locked(self, obj):
        if obj.locked_until and obj.locked_until > timezone.now():
            return "Yes"
        return "No"

    is_locked.short_description = "Currently locked"

    def get_readonly_fields(self, request, obj=None):
        return self.readonly_fields
