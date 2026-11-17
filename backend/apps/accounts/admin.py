from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


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
