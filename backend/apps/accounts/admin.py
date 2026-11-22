from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import College, CollegeAlias, User


class CollegeAliasInline(admin.TabularInline):
    model = CollegeAlias
    extra = 1
    verbose_name = "alternative spelling"
    verbose_name_plural = "alternative spellings"


@admin.register(College)
class CollegeAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "kind", "is_active", "sort_order", "members")
    list_filter = ("kind", "is_active")
    search_fields = ("name", "code", "aliases__text")
    inlines = (CollegeAliasInline,)

    @admin.display(description="accounts")
    def members(self, obj):
        return obj.members.count()


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
    list_filter = ("role", "member_type", "status", "college", "is_active", "is_staff")
    search_fields = ("email", "display_name", "college__name", "college__code")

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
