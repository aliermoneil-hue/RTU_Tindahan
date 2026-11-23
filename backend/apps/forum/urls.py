from rest_framework.routers import SimpleRouter

from .views import ForumCommentViewSet, ForumPostViewSet, ForumReportViewSet

router = SimpleRouter()
router.register("forum/posts", ForumPostViewSet, basename="forum-post")
router.register("forum/comments", ForumCommentViewSet, basename="forum-comment")
router.register("forum/reports", ForumReportViewSet, basename="forum-report")

urlpatterns = router.urls
