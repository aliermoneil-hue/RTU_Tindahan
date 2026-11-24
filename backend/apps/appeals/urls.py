from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import AppealViewSet, SuspensionAppealView

router = DefaultRouter()
router.register("appeals", AppealViewSet, basename="appeal")

urlpatterns = [
    # Before the router, so "suspension" is not read as an appeal id.
    path("appeals/suspension/", SuspensionAppealView.as_view(), name="appeal-suspension"),
    *router.urls,
]
