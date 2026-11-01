"""Endpoints behind the admin front end.

All of them live under /api/v1/admin/ and repeat their role checks on the
server. Hiding a button in React is only a convenience.
"""

from datetime import timedelta

from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from .admin_serializers import AdminUserSerializer, AdminUserUpdateSerializer
from .models import User
from .permissions import IsAdministrator, IsBackOffice, IsOfficeStaff


class AdminUserPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class AdminUserListView(ListAPIView):
    """GET /admin/users/ - search, filter, sort, and page through accounts."""

    permission_classes = [IsOfficeStaff]
    serializer_class = AdminUserSerializer
    pagination_class = AdminUserPagination

    SORTABLE = {
        "date_joined", "-date_joined",
        "display_name", "-display_name",
        "email", "-email",
        "role", "-role",
        "status", "-status",
    }

    def get_queryset(self):
        params = self.request.query_params
        queryset = User.objects.all()

        search = params.get("q", "").strip()
        if search:
            queryset = queryset.filter(
                Q(email__icontains=search)
                | Q(display_name__icontains=search)
                | Q(college__icontains=search)
            )

        role = params.get("role", "")
        if role in User.Role.values:
            queryset = queryset.filter(role=role)

        account_status = params.get("status", "")
        if account_status in User.Status.values:
            queryset = queryset.filter(status=account_status)

        member_type = params.get("member_type", "")
        if member_type in User.MemberType.values:
            queryset = queryset.filter(member_type=member_type)

        verified = params.get("verified", "").lower()
        if verified == "true":
            queryset = queryset.filter(verified_at__isnull=False)
        elif verified == "false":
            queryset = queryset.filter(verified_at__isnull=True)

        ordering = params.get("ordering", "-date_joined")
        if ordering not in self.SORTABLE:
            ordering = "-date_joined"
        return queryset.order_by(ordering, "-id")


class AdminUserDetailView(APIView):
    """GET /admin/users/<id>/ and PATCH /admin/users/<id>/."""

    def get_permissions(self):
        if self.request.method == "PATCH":
            return [IsAdministrator()]
        return [IsOfficeStaff()]

    def get(self, request, pk):
        user = get_object_or_404(User, pk=pk)
        return Response(AdminUserSerializer(user).data)

    def patch(self, request, pk):
        user = get_object_or_404(User, pk=pk)
        serializer = AdminUserUpdateSerializer(
            user, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(AdminUserSerializer(user).data)


class AdminUserVerifyView(APIView):
    """POST /admin/users/<id>/verify/ - Office Staff verify an account by hand."""

    permission_classes = [IsOfficeStaff]

    def post(self, request, pk):
        user = get_object_or_404(User, pk=pk)

        if user.is_verified:
            return Response(
                {"detail": "This account is already verified."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not user.can_sign_in:
            return Response(
                {"detail": "Reactivate this account before verifying it."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.verify()
        return Response(AdminUserSerializer(user).data)


class AdminSummaryView(APIView):
    """GET /admin/summary/ - the numbers on the dashboard."""

    permission_classes = [IsBackOffice]

    @staticmethod
    def _counts(field, choices):
        found = {
            row[field]: row["total"]
            for row in User.objects.values(field).annotate(total=Count("id"))
        }
        return {value: found.get(value, 0) for value in choices}

    def get(self, request):
        week_ago = timezone.now() - timedelta(days=7)
        # Moderators see the counts only; names and emails stay with Office Staff.
        recent = (
            User.objects.order_by("-date_joined", "-id")[:6]
            if request.user.is_office_staff
            else User.objects.none()
        )

        return Response(
            {
                "total": User.objects.count(),
                "unverified": User.objects.filter(verified_at__isnull=True).count(),
                "new_last_7_days": User.objects.filter(date_joined__gte=week_ago).count(),
                "by_role": self._counts("role", User.Role.values),
                "by_status": self._counts("status", User.Status.values),
                "by_member_type": self._counts("member_type", User.MemberType.values),
                "recent": AdminUserSerializer(recent, many=True).data,
            }
        )
