from django.urls import path

from .views import (
    ChangePasswordView,
    DeleteAccountView,
    LoginStatusView,
    LoginView,
    LogoutView,
    MeView,
    PasswordResetConfirmView,
    PasswordResetView,
    RegisterView,
    ResendCodeView,
    ResendVerificationView,
    VerifyCodeView,
    VerifyEmailView,
)

app_name = "accounts"

urlpatterns = [
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
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/login-status/", LoginStatusView.as_view(), name="login-status"),
    path("auth/password-reset/", PasswordResetView.as_view(), name="password-reset"),
    path(
        "auth/password-reset/confirm/",
        PasswordResetConfirmView.as_view(),
        name="password-reset-confirm",
    ),
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    path("auth/me/", MeView.as_view(), name="me"),
    path(
        "auth/change-password/", ChangePasswordView.as_view(), name="change-password"
    ),
    path(
        "auth/delete-account/", DeleteAccountView.as_view(), name="delete-account"
    ),
]
