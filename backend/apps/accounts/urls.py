from django.urls import path

from .views import (
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
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    path("auth/logout-all/", LogoutAllView.as_view(), name="logout-all"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("auth/me/", MeView.as_view(), name="me"),
]
