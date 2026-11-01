from django.contrib import admin

from .models import (
    DailyCount,
    EmailOutbox,
    OfficialTicket,
    StockMovement,
    StoreSetting,
    TicketItem,
    TicketStatusHistory,
)


class TicketItemInline(admin.TabularInline):
    model = TicketItem
    extra = 0
    can_delete = False
    fields = ("listing", "variant", "quantity", "unit_price")
    readonly_fields = ("listing", "variant", "quantity", "unit_price")


class TicketStatusHistoryInline(admin.TabularInline):
    model = TicketStatusHistory
    extra = 0
    can_delete = False
    readonly_fields = ("from_status", "to_status", "changed_by", "note", "created_at")


@admin.register(OfficialTicket)
class OfficialTicketAdmin(admin.ModelAdmin):
    list_display = ("reference", "buyer", "status", "pickup_date", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("reference", "buyer__email", "buyer__display_name")
    list_select_related = ("buyer", "processed_by")
    readonly_fields = ("reference", "status", "created_at", "updated_at")
    inlines = [TicketItemInline, TicketStatusHistoryInline]
    date_hierarchy = "created_at"


@admin.register(StoreSetting)
class StoreSettingAdmin(admin.ModelAdmin):
    list_display = (
        "low_stock_threshold",
        "max_quantity_per_ticket",
        "ordering_window_enabled",
        "updated_at",
    )

    def has_add_permission(self, request):
        return not StoreSetting.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = (
        "created_at",
        "variant",
        "kind",
        "quantity",
        "on_hand_after",
        "available_after",
        "ticket",
        "created_by",
    )
    list_filter = ("kind", "created_at")
    search_fields = ("variant__listing__title", "variant__name", "reason")
    list_select_related = ("variant", "ticket", "created_by")
    date_hierarchy = "created_at"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(DailyCount)
class DailyCountAdmin(admin.ModelAdmin):
    list_display = (
        "counted_on",
        "variant",
        "expected_on_hand",
        "counted_quantity",
        "difference",
        "counted_by",
    )
    list_filter = ("counted_on",)
    search_fields = ("variant__listing__title", "variant__name", "reason")
    list_select_related = ("variant", "counted_by")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(EmailOutbox)
class EmailOutboxAdmin(admin.ModelAdmin):
    list_display = ("created_at", "kind", "event", "subject", "state", "ticket")
    list_filter = ("kind", "state", "event")
    search_fields = ("subject", "recipients", "ticket__reference")
    readonly_fields = (
        "ticket",
        "kind",
        "event",
        "recipients",
        "subject",
        "body",
        "state",
        "note",
        "sent_at",
        "created_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
