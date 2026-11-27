from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.decorators.cache import cache_control
from django.views.static import serve as serve_media

from config.views import api_root, health, stats

urlpatterns = [
    path("", api_root, name="api-root"),
    path("health/", health, name="health"),
    path("api/v1/stats/", stats, name="api-stats"),
    path("admin/", admin.site.urls),
    # Exact /api/v1/ shows the index; sub-paths go to the app routers.
    path("api/v1/", api_root, name="api-v1-root"),
    path("api/v1/", include("apps.accounts.urls")),
    path("api/v1/", include("apps.catalog.urls")),
    path("api/v1/", include("apps.store.urls")),
    path("api/v1/", include("apps.orders.urls")),
    path("api/v1/", include("apps.messaging.urls")),
    path("api/v1/", include("apps.favorites.urls")),
    path("api/v1/", include("apps.reviews.urls")),
    path("api/v1/", include("apps.forum.urls")),
    path("api/v1/", include("apps.appeals.urls")),
    path("api/v1/", include("apps.screening.urls")),
    path("api/v1/", include("apps.notifications.urls")),
    path("api/v1/", include("apps.audit.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
else:
    # `static()` is a no-op when DEBUG is off, which would leave every uploaded
    # listing photo as a 404 on the deployed site. The tunnel forwards /media/
    # straight to this process, so serve it here rather than from a web server
    # that is not in front of Django yet.
    urlpatterns += [
        re_path(
            r"^media/(?P<path>.*)$",
            # Listing photos travel Vercel -> tunnel -> this process on every
            # request. Letting the browser keep them for a week removes that
            # round trip on every visit after the first.
            cache_control(public=True, max_age=60 * 60 * 24 * 7)(serve_media),
            {"document_root": settings.MEDIA_ROOT},
        )
    ]
