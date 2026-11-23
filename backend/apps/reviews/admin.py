from django.contrib import admin

from .models import Review


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ("order", "buyer", "seller", "listing", "stars", "created_at")
    list_filter = ("stars", "created_at")
    search_fields = ("order__reference", "buyer__email", "seller__email", "listing__title")
    raw_id_fields = ("order", "buyer", "seller", "listing")
