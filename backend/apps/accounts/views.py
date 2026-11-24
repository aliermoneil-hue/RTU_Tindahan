from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from rest_framework import serializers, status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .emails import send_verification_code_email, send_verification_email
from .lockout import FailureResult, current_lock, record_failure, reset
from .models import User
from .serializers import (
    ChangePasswordSerializer,
    DeleteAccountSerializer,
    LoginSerializer,
    ProfileUpdateSerializer,
    RegisterSerializer,
    ResendCodeSerializer,
    ResendVerificationSerializer,
    UserSerializer,
    VerifyCodeSerializer,
    VerifyEmailSerializer,
)
from .verification import (
    CODE_TTL_MINUTES,
    RESEND_SECONDS,
    CodeError,
    check_code,
    issue_code,
    start_cooldown,
)


def auth_payload(user: User) -> dict:
    token, _ = Token.objects.get_or_create(user=user)
    return {"token": token.key, "user": UserSerializer(user).data}


class RegisterView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "register"

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # AV-03: the account stays a visitor until the emailed code is used.
        code = issue_code(user)
        send_verification_code_email(user, code)

        return Response(
            {
                "detail": (
                    "Account created. We emailed a 6-digit code to your RTU "
                    "address."
                ),
                "email": user.email,
                "code_expires_in_minutes": CODE_TTL_MINUTES,
            },
            status=status.HTTP_201_CREATED,
        )


class VerifyCodeView(APIView):
    """AV-03: enter the 6-digit code to activate the account and sign in."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "verify"

    def post(self, request):
        serializer = VerifyCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"].lower()
        submitted = serializer.validated_data["code"]

        user = User.objects.filter(email=email).first()
        if user is None:
            # AV-06: do not reveal whether the address is registered.
            return Response(
                {"detail": "That code is not right.", "code": "code_invalid"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not user.can_sign_in:
            return Response(
                {
                    "detail": "This account is suspended or banned.",
                    "code": "account_suspended",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if user.is_verified:
            # Never hand out a token here: the code is gone, so anyone who
            # knows the address could otherwise sign in without a password.
            return Response(
                {
                    "detail": (
                        "This account is already verified. Sign in with your "
                        "password."
                    ),
                    "code": "already_verified",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            check_code(user, submitted)
        except CodeError as exc:
            return Response(
                {"detail": exc.message, "code": "code_invalid"},
                status=exc.status,
            )

        user.verify()
        payload = auth_payload(user)
        payload["detail"] = "Your RTU email is confirmed. You are now signed in."
        return Response(payload)


class ResendCodeView(APIView):
    """AV-03: send a fresh code, with a short cooldown to stop abuse."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "verify"

    def post(self, request):
        serializer = ResendCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].lower()

        if not start_cooldown(email):
            return Response(
                {
                    "detail": (
                        f"Please wait {RESEND_SECONDS} seconds before asking for "
                        "another code."
                    ),
                    "code": "code_cooldown",
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        user = User.objects.filter(email=email).first()
        if user and not user.is_verified and user.can_sign_in:
            code = issue_code(user)
            send_verification_code_email(user, code)

        # Same answer either way, so the endpoint cannot be used to test emails.
        return Response(
            {
                "detail": (
                    "If that RTU email is waiting for verification, a new code "
                    "has been sent."
                )
            }
        )


class VerifyEmailView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "verify"

    def post(self, request):
        serializer = VerifyEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            user_id = force_str(urlsafe_base64_decode(serializer.validated_data["uid"]))
            user = User.objects.get(pk=user_id)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response(
                {"detail": "This verification link is not valid."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not user.can_sign_in:
            return Response(
                {"detail": "This account is suspended or banned."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not default_token_generator.check_token(
            user, serializer.validated_data["token"]
        ):
            return Response(
                {"detail": "This verification link is invalid or has expired."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.verify()
        payload = auth_payload(user)
        payload["detail"] = "Your RTU email is verified. You are now signed in."
        return Response(payload)


class ResendVerificationView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "verify"

    def post(self, request):
        serializer = ResendVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].lower()

        user = User.objects.filter(email=email).first()
        # Do not reveal whether an address is registered.
        if user and not user.is_verified and user.can_sign_in:
            send_verification_email(user)

        return Response(
            {"detail": "If that RTU email is registered and unverified, a new link has been sent."}
        )


class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"].strip().lower()
        password = serializer.validated_data["password"]

        # 1. Check if the email is currently locked (cooldown or restricted).
        #    Return 429 without touching the password, so a locked account does
        #    not reveal whether the password would have been right.
        lock = current_lock(email)
        if lock is not None:
            return Response(
                {
                    "detail": (
                        "Too many failed attempts. Try again in a moment, or reset your password."
                        if lock.kind == "cooldown"
                        else "Your login access is temporarily restricted for security reasons. "
                        "Try again later, or reset your password."
                    ),
                    "code": "login_cooldown" if lock.kind == "cooldown" else "login_restricted",
                    "retry_after": lock.retry_after,
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
                headers={"Retry-After": str(lock.retry_after)},
            )

        # 2. Look up the user and check the password.
        user = User.objects.filter(email=email).first()

        # AV-06: do not say which half of the pair was wrong.
        if user is None or not user.check_password(password):
            result = record_failure(email)

            # If recording this failure created a lock, return 429 immediately

            # If recording this failure created a lock, return 429 immediately
            # (so attempt 5 and attempt 7 show the timer right away).
            if result.locked:
                return Response(
                    {
                        "detail": (
                            "Too many failed attempts. Try again in a moment, or reset your password."
                            if result.kind == "cooldown"
                            else "Your login access is temporarily restricted for security reasons. "
                            "Try again later, or reset your password."
                        ),
                        "code": "login_cooldown" if result.kind == "cooldown" else "login_restricted",
                        "retry_after": result.retry_after,
                    },
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                    headers={"Retry-After": str(result.retry_after)},
                )

            # Not yet locked: return 400 with attempts_left and next_penalty.
            return Response(
                {
                    "detail": "Email or password is incorrect.",
                    "attempts_left": result.attempts_left,
                    "next_penalty": result.next_penalty,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 3. Password correct: reset the failed-attempt counter.
        reset(email)

        if user.status == User.Status.BANNED:
            return Response(
                {"detail": "This account is banned.", "code": "account_banned"},
                status=status.HTTP_403_FORBIDDEN,
            )
        if user.status == User.Status.SUSPENDED or not user.is_active:
            return Response(
                {"detail": "This account is suspended.", "code": "account_suspended"},
                status=status.HTTP_403_FORBIDDEN,
            )

        # AV-03: activate only after the email link is confirmed.
        if not user.is_verified:
            return Response(
                {
                    "detail": "Verify your RTU email before signing in.",
                    "code": "email_not_verified",
                    "email": user.email,
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        return Response(auth_payload(user))


class LoginStatusView(APIView):
    """Return the current lock state for an email (AllowAny, throttled).

    Used by the frontend after a page refresh to show the remaining cooldown /
    restriction timer without revealing whether the email exists.
    """

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login-status"

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        lock = current_lock(email)

        if lock is None:
            return Response({"locked": False, "code": None, "retry_after": 0})

        return Response(
            {
                "locked": True,
                "code": "login_cooldown" if lock.kind == "cooldown" else "login_restricted",
                "retry_after": lock.retry_after,
            }
        )


class PasswordResetSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetView(APIView):
    """Send a 6-digit password-reset code to the email (AllowAny, throttled).

    Does not reveal whether the address is registered.
    """

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "verify"

    def post(self, request):
        serializer = PasswordResetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].strip().lower()

        user = User.objects.filter(email=email).first()
        if user and user.is_verified and user.can_sign_in:
            code = issue_code(user)
            send_verification_code_email(user, code)

        # Same answer either way, so the endpoint cannot be used to test emails.
        return Response(
            {
                "detail": (
                    "If that RTU email is registered and verified, a 6-digit "
                    "code has been sent to your inbox."
                )
            }
        )


class PasswordResetConfirmSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.RegexField(
        r"^\d{6}$",
        error_messages={"invalid": "Enter the 6 digits from the email."},
    )
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    password_confirm = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError(
                {"password_confirm": "The two passwords do not match."}
            )
        return attrs


class PasswordResetConfirmView(APIView):
    """Confirm a password reset using a 6-digit code, then clear the lockout."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "verify"

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"].strip().lower()
        code = serializer.validated_data["code"]

        user = User.objects.filter(email=email).first()
        if user is None or not user.is_verified:
            # Do not reveal whether the address exists.
            return Response(
                {"detail": "Invalid code or reset failed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            check_code(user, code)
        except CodeError as exc:
            return Response(
                {"detail": exc.message},
                status=exc.status,
            )

        with transaction.atomic():
            user.set_password(serializer.validated_data["password"])
            user.save(update_fields=["password"])
            # Clear the lockout so the user can sign in at once.
            reset(email)

        return Response({"detail": "Password reset complete. You can sign in with your new password."})


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = ProfileUpdateSerializer(
            request.user, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        try:
            serializer.save()
        except DjangoValidationError as exc:
            return Response(
                {"detail": exc.messages}, status=status.HTTP_400_BAD_REQUEST
            )
        return Response(UserSerializer(request.user).data)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        user = request.user
        user.set_password(serializer.validated_data["new_password"])
        user.save(update_fields=["password"])
        return Response({"detail": "Password changed."})


class DeleteAccountView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = DeleteAccountSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        user = request.user

        # Check whether deleting this user would break listings or tickets.
        from apps.catalog.models import Listing
        from apps.store.models import OfficialTicket

        has_listings = Listing.objects.filter(seller=user).exists()
        has_tickets = OfficialTicket.objects.filter(buyer=user).exists() or (
            hasattr(OfficialTicket, "processed_by")
            and OfficialTicket.objects.filter(processed_by=user).exists()
        )

        if has_listings or has_tickets:
            # Cannot hard-delete: deactivate and scrub personal data instead.
            user.is_active = False
            user.display_name = "Deleted account"
            user.email = f"deleted_{user.pk}@rtu.edu.ph"
            user.contact_number = ""
            user.profile_photo = None
            user.save()
            user_pk = user.pk
        else:
            user_pk = user.pk
            user.delete()

        # Remove auth tokens so all sessions are invalidated.
        Token.objects.filter(user_id=user_pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
