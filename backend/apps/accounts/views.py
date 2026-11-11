from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .emails import send_verification_code_email, send_verification_email
from .models import User
from .serializers import (
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

        email = serializer.validated_data["email"].lower()
        password = serializer.validated_data["password"]
        user = User.objects.filter(email=email).first()

        # AV-06: do not say which half of the pair was wrong.
        if user is None or not user.check_password(password):
            return Response(
                {"detail": "Email or password is incorrect."},
                status=status.HTTP_400_BAD_REQUEST,
            )

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
