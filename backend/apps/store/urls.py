from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import (
    DailyCountViewSet,
    EmailOutboxViewSet,
    OfficialTicketViewSet,
    StockInView,
    StockLedgerViewSet,
    StoreSettingView,
    WalkInSaleView,
)

router = SimpleRouter()
router.register("store/tickets", OfficialTicketViewSet, basename="official-ticket")
router.register("store/stock", StockLedgerViewSet, basename="stock-movement")
router.register("store/daily-counts", DailyCountViewSet, basename="daily-count")
router.register("store/outbox", EmailOutboxViewSet, basename="store-outbox")

urlpatterns = [
    # Fixed paths first; they cannot collide with the router's <pk> patterns
    # because "stock-in" never follows the ".../stock/<pk>/" shape.
    path("store/stock-in/", StockInView.as_view(), name="stock-in"),
    path("store/sales/", WalkInSaleView.as_view(), name="store-sales"),
    path("store/settings/", StoreSettingView.as_view(), name="store-settings"),
    *router.urls,
]
