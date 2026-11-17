from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from .models import User
from .verification import CODE_TTL_MINUTES, RESET_TTL_MINUTES


def build_verification_link(user: User) -> str:
    """Return the React URL that confirms an account (AV-03)."""
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    base = settings.FRONTEND_URL.rstrip("/")
    return f"{base}/verify-email?uid={uid}&token={token}"


def send_verification_email(user: User) -> None:
    link = build_verification_link(user)
    subject = "Verify your RTU Tindahan account"
    message = (
        f"Hello {user.display_name},\n\n"
        "Thank you for registering for RTU Tindahan.\n"
        "Open the link below to verify your RTU email address and activate "
        "your account:\n\n"
        f"{link}\n\n"
        "If you did not create this account, you can ignore this message.\n\n"
        "RTU Tindahan\n"
        "Rizal Technological University, Pasig Campus"
    )
    send_mail(
        subject=subject,
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )


def send_verification_code_email(user: User, code: str) -> None:
    """Email the 6-digit sign-up code (AV-03, code-based flow)."""
    subject = "Your RTU Tindahan verification code"
    message = (
        f"Hello {user.display_name},\n\n"
        f"Your verification code is: {code}\n\n"
        f"Enter it on the sign-up screen. The code expires in "
        f"{CODE_TTL_MINUTES} minutes.\n\n"
        "If you did not create this account, you can ignore this message.\n\n"
        "RTU Tindahan\n"
        "Rizal Technological University, Pasig Campus"
    )
    send_mail(
        subject=subject,
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )


def send_password_reset_code_email(user: User, code: str) -> None:
    """Email the 6-digit password reset code (AV-06).

    Deliberately says what to do if the request was not expected: a reset mail
    arriving unrequested is the first sign of someone probing an account, and
    the reader should be told to change their password rather than ignore it.
    """
    subject = "Reset your RTU Tindahan password"
    message = (
        f"Hello {user.display_name},\n\n"
        f"Your password reset code is: {code}\n\n"
        f"Enter it on the reset screen. The code expires in "
        f"{RESET_TTL_MINUTES} minutes.\n\n"
        "If you did not ask to reset your password, do not share this code. "
        "Sign in and change your password, then tell your instructor or the "
        "site administrator.\n\n"
        "RTU Tindahan\n"
        "Rizal Technological University, Pasig Campus"
    )
    send_mail(
        subject=subject,
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )
