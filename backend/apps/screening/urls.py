from rest_framework.routers import SimpleRouter

from .views import ScreeningRuleViewSet

router = SimpleRouter()
router.register("screening-rules", ScreeningRuleViewSet, basename="screening-rule")

urlpatterns = router.urls
