from django.urls import include, path
from rest_framework.routers import SimpleRouter

from .views import ModerationQueueViewSet, ScreeningLogViewSet

router = SimpleRouter()
router.register("moderation/queue", ModerationQueueViewSet, basename="moderation-queue")
router.register("moderation/screening-log", ScreeningLogViewSet, basename="screening-log")

app_name = "screening"

urlpatterns = [path("", include(router.urls))]
