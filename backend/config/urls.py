from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from config.views import api_root, health

urlpatterns = [
    path("", api_root, name="api-root"),
    path("health/", health, name="health"),
    path("admin/", admin.site.urls),
    # Exact /api/v1/ shows the index; sub-paths go to the app routers.
    path("api/v1/", api_root, name="api-v1-root"),
    path("api/v1/", include("apps.accounts.urls")),
    path("api/v1/", include("apps.catalog.urls")),
    path("api/v1/", include("apps.store.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
