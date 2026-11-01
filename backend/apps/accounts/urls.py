from django.urls import path

from .admin_views import (
    AdminSummaryView,
    AdminUserDetailView,
    AdminUserListView,
    AdminUserVerifyView,
)
from .views import (
    LoginView,
    LogoutView,
    MeView,
    RegisterView,
    ResendVerificationView,
    VerifyEmailView,
)

app_name = "accounts"

urlpatterns = [
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/verify-email/", VerifyEmailView.as_view(), name="verify-email"),
    path(
        "auth/resend-verification/",
        ResendVerificationView.as_view(),
        name="resend-verification",
    ),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    path("auth/me/", MeView.as_view(), name="me"),
    # Admin front end (AD-01).
    path("admin/summary/", AdminSummaryView.as_view(), name="admin-summary"),
    path("admin/users/", AdminUserListView.as_view(), name="admin-users"),
    path("admin/users/<int:pk>/", AdminUserDetailView.as_view(), name="admin-user"),
    path(
        "admin/users/<int:pk>/verify/",
        AdminUserVerifyView.as_view(),
        name="admin-user-verify",
    ),
]
