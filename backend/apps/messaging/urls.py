from rest_framework.routers import SimpleRouter

from .views import ConversationReportViewSet, ConversationViewSet

router = SimpleRouter()
router.register("conversations", ConversationViewSet, basename="conversation")
router.register("message-reports", ConversationReportViewSet, basename="message-report")

urlpatterns = router.urls
