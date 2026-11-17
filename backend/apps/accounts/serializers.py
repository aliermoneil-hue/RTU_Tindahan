from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import User
from .validators import normalize_email, validate_rtu_email


class UserSerializer(serializers.ModelSerializer):
    is_verified = serializers.BooleanField(read_only=True)
    student_number = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "display_name",
            "role",
            "member_type",
            "college",
            "year_level",
            "student_number",
            "contact_number",
            "profile_photo",
            "status",
            "is_verified",
            "date_joined",
        )
        read_only_fields = fields

    def get_student_number(self, obj: User) -> str | None:
        from .validators import student_number_from_email

        return student_number_from_email(obj.email)


class RegisterSerializer(serializers.Serializer):
    """AV-01 to AV-04: create an account and start email verification."""

    email = serializers.EmailField()
    display_name = serializers.CharField(max_length=120)
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    password_confirm = serializers.CharField(write_only=True, trim_whitespace=False)
    member_type = serializers.ChoiceField(choices=User.MemberType.choices)
    college = serializers.CharField(max_length=150)
    year_level = serializers.IntegerField(min_value=1, max_value=6, required=False, allow_null=True)
    contact_number = serializers.CharField(
        max_length=20, required=False, allow_blank=True, default=""
    )
    privacy_consent = serializers.BooleanField()

    def validate_email(self, value: str) -> str:
        value = normalize_email(value)
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate(self, attrs):
        member_type = attrs["member_type"]

        # AV-01/AV-02 and AV-04: official RTU address, student-number form.
        try:
            attrs["email"] = validate_rtu_email(attrs["email"], member_type)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"email": list(exc.messages)})

        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError(
                {"password_confirm": "The two passwords do not match."}
            )

        candidate = User(
            email=attrs["email"],
            display_name=attrs["display_name"],
            member_type=member_type,
        )
        try:
            validate_password(attrs["password"], user=candidate)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)})

        year_level = attrs.get("year_level")
        if member_type == User.MemberType.STUDENT and year_level is None:
            raise serializers.ValidationError(
                {"year_level": "Year level is required for students."}
            )
        if member_type != User.MemberType.STUDENT and year_level is not None:
            raise serializers.ValidationError(
                {"year_level": "Only students have a year level."}
            )

        if not attrs["college"].strip():
            raise serializers.ValidationError(
                {"college": "Enter your college, institute, or office."}
            )

        # PR-02: the privacy notice must be accepted at registration.
        if not attrs["privacy_consent"]:
            raise serializers.ValidationError(
                {"privacy_consent": "You must accept the privacy notice to register."}
            )

        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        validated_data.pop("privacy_consent")

        user = User.objects.create_user(
            email=validated_data["email"],
            display_name=validated_data["display_name"],
            password=validated_data["password"],
            member_type=validated_data["member_type"],
            college=validated_data["college"].strip(),
            year_level=validated_data.get("year_level"),
            contact_number=validated_data.get("contact_number", "").strip(),
            role=User.Role.VISITOR,
        )
        # The view issues the 6-digit code and emails it, so that a failed
        # send can be reported instead of leaving a silent half-signup.
        return user


class VerifyCodeSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.RegexField(
        r"^\d{6}$",
        error_messages={"invalid": "Enter the 6 digits from the email."},
    )


class ResendCodeSerializer(serializers.Serializer):
    email = serializers.EmailField()


class VerifyEmailSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()


class ResendVerificationSerializer(serializers.Serializer):
    email = serializers.EmailField()


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)


class PasswordResetRequestSerializer(serializers.Serializer):
    """AV-06: the address to send a reset code to."""

    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    """AV-06: the code plus the new password."""

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
        # Same validators the model uses, so a reset cannot install a password
        # that sign-up would have refused.
        candidate = User(email=attrs["email"])
        try:
            validate_password(attrs["password"], user=candidate)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)})
        return attrs


class ProfileUpdateSerializer(serializers.ModelSerializer):
    """AV-07/AV-08: editable profile fields. Email and role are not editable."""

    class Meta:
        model = User
        fields = ("display_name", "college", "year_level", "contact_number", "profile_photo")

    def validate(self, attrs):
        year_level = attrs.get("year_level", self.instance.year_level)
        if self.instance.member_type == User.MemberType.STUDENT and year_level is None:
            raise serializers.ValidationError(
                {"year_level": "Year level is required for students."}
            )
        if self.instance.member_type != User.MemberType.STUDENT and year_level is not None:
            raise serializers.ValidationError(
                {"year_level": "Only students have a year level."}
            )
        return attrs

    def validate_profile_photo(self, value):
        if value and value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("The photo must be 5 MB or smaller.")
        return value
