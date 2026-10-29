from django.contrib import admin

from .models import Category, Listing, ListingPhoto


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "parent", "sort_order", "is_active")
    list_filter = ("is_active", "parent")
    search_fields = ("name",)
    ordering = ("sort_order", "name")


class ListingPhotoInline(admin.TabularInline):
    model = ListingPhoto
    extra = 1


@admin.register(Listing)
class ListingAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "seller",
        "category",
        "listing_type",
        "price",
        "status",
        "is_official",
        "created_at",
    )
    list_filter = ("status", "listing_type", "is_official", "category")
    search_fields = ("title", "description", "seller__email", "seller__display_name")
    list_select_related = ("seller", "category")
    inlines = [ListingPhotoInline]
    readonly_fields = ("slug", "created_at", "updated_at", "published_at")
    date_hierarchy = "created_at"
