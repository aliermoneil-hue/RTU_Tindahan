from django.urls import path

from .admin_api import AdminUserViewSet, DatabaseBackupView
from .views import (
    CollegeListView,
    ChangePasswordView,
    DeleteAccountView,
    LoginStatusView,
    LoginView,
    LogoutAllView,
    LogoutView,
    MeView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    RegisterView,
    ResendCodeView,
    ResendVerificationView,
    TokenRefreshView,
    VerifyCodeView,
    VerifyEmailView,
)

app_name = "accounts"

urlpatterns = [
    # The picklist the sign-up form renders, so a typo cannot invent a college.
    path("colleges/", CollegeListView.as_view(), name="colleges"),
    path("auth/register/", RegisterView.as_view(), name="register"),
    # The code that the sign-up screens use.
    path("auth/verify-code/", VerifyCodeView.as_view(), name="verify-code"),
    path("auth/resend-code/", ResendCodeView.as_view(), name="resend-code"),
    # Link-based verification is kept for accounts verified by hand.
    path("auth/verify-email/", VerifyEmailView.as_view(), name="verify-email"),
    path(
        "auth/resend-verification/",
        ResendVerificationView.as_view(),
        name="resend-verification",
    ),
    # AV-06: forgotten password, by emailed code.
    path(
        "auth/password-reset/",
        PasswordResetRequestView.as_view(),
        name="password-reset",
    ),
    path(
        "auth/password-reset/confirm/",
        PasswordResetConfirmView.as_view(),
        name="password-reset-confirm",
    ),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/login-status/", LoginStatusView.as_view(), name="login-status"),
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    path("auth/logout-all/", LogoutAllView.as_view(), name="logout-all"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("auth/me/", MeView.as_view(), name="me"),
    # The Users and audit screen. Read is open to staff; the two writes are
    # administrator-only and are enforced by the actions themselves.
    path(
        "admin/users/",
        AdminUserViewSet.as_view({"get": "list"}),
        name="admin-users",
    ),
    path(
        "admin/users/<int:pk>/",
        AdminUserViewSet.as_view({"get": "retrieve"}),
        name="admin-user",
    ),
    path(
        "admin/users/<int:pk>/status/",
        AdminUserViewSet.as_view({"post": "status"}),
        name="admin-user-status",
    ),
    path(
        "admin/users/<int:pk>/role/",
        AdminUserViewSet.as_view({"post": "role"}),
        name="admin-user-role",
    ),
    # A consistent copy of the live database, administrator only.
    path(
        "admin/backup/",
        DatabaseBackupView.as_view(),
        name="admin-backup",
    ),
    # The signed-in member's own account: change the password, or delete.
    path(
        "auth/change-password/", ChangePasswordView.as_view(), name="change-password"
    ),
    path(
        "auth/delete-account/", DeleteAccountView.as_view(), name="delete-account"
    ),
]
