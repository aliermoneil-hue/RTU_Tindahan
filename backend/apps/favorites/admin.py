from django.contrib import admin

from .models import Favorite


@admin.register(Favorite)
class FavoriteAdmin(admin.ModelAdmin):
    list_display = ("user", "listing", "seller", "created_at")
    list_filter = ("created_at",)
    search_fields = ("user__email", "seller__email", "listing__title")
    raw_id_fields = ("user", "listing", "seller")
