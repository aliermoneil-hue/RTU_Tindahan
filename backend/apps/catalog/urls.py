from rest_framework.routers import SimpleRouter

from .views import CategoryViewSet, ListingViewSet

# SimpleRouter rather than DefaultRouter: the project already has its own
# index view at /api/v1/, so a second API root would only be confusing.
router = SimpleRouter()
router.register("categories", CategoryViewSet, basename="category")
router.register("listings", ListingViewSet, basename="listing")

urlpatterns = router.urls
