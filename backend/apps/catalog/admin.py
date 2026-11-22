from django.contrib import admin

from .models import Category, Listing, ListingPhoto, ListingVariant


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "parent", "sort_order", "is_active")
    list_filter = ("is_active", "parent")
    search_fields = ("name",)
    ordering = ("sort_order", "name")


class ListingVariantInline(admin.TabularInline):
    model = ListingVariant
    extra = 1
    fields = (
        "name",
        "sku",
        "price",
        "on_hand",
        "available",
        "low_stock_threshold",
        "is_active",
    )
    readonly_fields = ("on_hand", "available")


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
        "moderation_status",
        "availability_status",
        "is_official",
        "created_at",
    )
    list_filter = (
        "moderation_status",
        "availability_status",
        "listing_type",
        "is_official",
        "category",
    )
    search_fields = ("title", "description", "seller__email", "seller__display_name")
    list_select_related = ("seller", "category")
    inlines = [ListingVariantInline, ListingPhotoInline]
    readonly_fields = ("slug", "created_at", "updated_at", "published_at")
    date_hierarchy = "created_at"
