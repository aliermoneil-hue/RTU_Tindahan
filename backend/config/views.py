"""Project-level views: API index, health check, and public stats."""

from django.db import connection
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.catalog.models import Listing
from apps.store.models import OfficialTicket


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
                "verify_code": f"{base}/auth/verify-code/",
                "resend_code": f"{base}/auth/resend-code/",
                "verify_email": f"{base}/auth/verify-email/",
                "resend_verification": f"{base}/auth/resend-verification/",
                "login": f"{base}/auth/login/",
                "logout": f"{base}/auth/logout/",
                "me": f"{base}/auth/me/",
                "categories": f"{base}/categories/",
                "listings": f"{base}/listings/",
                "official_tickets": f"{base}/store/tickets/",
                "stock_ledger": f"{base}/store/stock/",
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


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def stats(request):
    """Public dashboard numbers shown to logged-out visitors.

    - listings_on_sale: approved, publicly visible listings.
    - completed_pickups: Official RTU Store tickets that have been claimed
      (picked up on campus). This is the backend's source of truth for
      completed campus pickups; no sign-in is required to read it.
    """
    # The catalogue's single `status` column was split into moderation and
    # availability (migration 0003), so "on sale" is both, from an active seller
    # — the same rule the marketplace feed applies.
    listings_on_sale = Listing.objects.filter(
        moderation_status=Listing.ModerationStatus.APPROVED,
        availability_status=Listing.AvailabilityStatus.AVAILABLE,
        seller__status="active",
    ).count()
    completed_pickups = OfficialTicket.objects.filter(
        status=OfficialTicket.Status.CLAIMED
    ).count()
    return Response(
        {
            "listings_on_sale": listings_on_sale,
            "completed_pickups": completed_pickups,
        }
    )
