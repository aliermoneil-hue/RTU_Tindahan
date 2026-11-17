"""Project-level views: API index and health check."""

from django.db import connection
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(["GET"])
@permission_classes([AllowAny])
def api_root(request):
    """Human-friendly index for the backend, shown at / and /api/v1/."""
    base = request.build_absolute_uri("/api/v1")

    return Response(
        {
            "service": "RTU Tindahan API",
            "status": "ok",
            "version": "v1",
            "message": "Backend is running. Use the endpoints below.",
            "endpoints": {
                "register": f"{base}/auth/register/",
                "verify_email": f"{base}/auth/verify-email/",
                "resend_verification": f"{base}/auth/resend-verification/",
                "login": f"{base}/auth/login/",
                "logout": f"{base}/auth/logout/",
                "me": f"{base}/auth/me/",
                "health": request.build_absolute_uri("/health/"),
                "admin": request.build_absolute_uri("/admin/"),
            },
            "documentation": "docs/SPRINT-1-FOUNDATION.md",
        }
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    """RL-01: lightweight availability check, including the database."""
    try:
        connection.ensure_connection()
        database = "ok"
        database_vendor = connection.vendor
    except Exception:
        database = "unavailable"
        database_vendor = connection.vendor

    status_code = 200 if database == "ok" else 503
    return Response(
        {
            "status": "ok" if status_code == 200 else "degraded",
            "database": database,
            "database_vendor": database_vendor,
        },
        status=status_code,
    )
