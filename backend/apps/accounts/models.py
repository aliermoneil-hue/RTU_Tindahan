from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator, RegexValidator
from django.db import models
from django.utils import timezone

from .managers import UserManager
from .validators import normalize_email, validate_rtu_email


def _normalize_place(text: str) -> str:
    """Casefold and collapse whitespace so one place has one spelling key."""
    return " ".join(str(text or "").split()).casefold()


class College(models.Model):
    """A college, institute or office. The dimension the user table depends on.

    Stored as its own table rather than free text on the account: the same unit
    was previously entered as both "College of Information and Communications
    Technology" and "BS Information Technology", which silently split reports.
    Synonym spellings live in CollegeAlias, so lookups keep working without
    duplicating the entity.
    """

    class Kind(models.TextChoices):
        COLLEGE = "college", "College"
        INSTITUTE = "institute", "Institute"
        OFFICE = "office", "Office"
        ADMINISTRATION = "administration", "Administration"

    code = models.CharField(
        max_length=24,
        unique=True,
        null=True,
        blank=True,
        help_text="Short code such as CICT. Left blank for places added by fixtures.",
    )
    name = models.CharField(max_length=150, unique=True)
    kind = models.CharField(
        max_length=20, choices=Kind.choices, default=Kind.COLLEGE
    )
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "name"]
        verbose_name = "college / office"
        verbose_name_plural = "colleges / offices"
        indexes = [models.Index(fields=["is_active", "sort_order"])]

    def __str__(self) -> str:
        return f"{self.name} ({self.code})" if self.code else self.name

    def save(self, *args, **kwargs):
        self.name = " ".join(self.name.split())
        if self.code:
            self.code = self.code.strip().upper()
        super().save(*args, **kwargs)

    @staticmethod
    def normalize(text: str) -> str:
        return _normalize_place(text)

    @classmethod
    def resolve(cls, text: str):
        """Find a college by code, name or alias. None when nothing matches."""
        key = cls.normalize(text)
        if not key:
            return None
        for place in cls.objects.prefetch_related("aliases").filter(is_active=True):
            if key in {cls.normalize(place.code), cls.normalize(place.name)}:
                return place
            if any(alias.text == key for alias in place.aliases.all()):
                return place
        return None

    @classmethod
    def resolve_or_create(cls, text: str):
        """Resolve, or create an inactive-code row for fixture and legacy callers.

        The API never uses this: RegisterSerializer resolves strictly and
        rejects unknown values, so typos cannot create new places through it.
        """
        place = cls.resolve(text)
        if place is not None:
            return place
        cleaned = " ".join(str(text or "").split())
        if not cleaned:
            return None
        place, _ = cls.objects.get_or_create(name=cleaned, defaults={"code": None})
        return place


class CollegeAlias(models.Model):
    """Another spelling of the same college, stored already normalised."""

    college = models.ForeignKey(
        College, on_delete=models.CASCADE, related_name="aliases"
    )
    text = models.CharField(max_length=150, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["text"]
        verbose_name = "college alias"
        verbose_name_plural = "college aliases"

    def __str__(self) -> str:
        return self.text

    def save(self, *args, **kwargs):
        self.text = _normalize_place(self.text)
        super().save(*args, **kwargs)


class User(AbstractBaseUser, PermissionsMixin):
    """Custom user model for the five SRS user classes.

    Visitor        A registered account whose RTU email is not verified yet.
    Verified User  A student, faculty member, or non-teaching personnel.
    Office Staff   Manages the Official Store and announcements.
    Moderator      Reviews flagged content, reports, and appeals.
    Administrator  Manages accounts, roles, categories, and audit logs.

    The role is stored on the account; anonymous browsing is handled by the
    Visitor user class in the SRS and does not need a database row.
    """

    class Role(models.TextChoices):
        VISITOR = "visitor", "Visitor"
        USER = "user", "Verified User"
        OFFICE_STAFF = "office_staff", "Office Staff"
        MODERATOR = "moderator", "Moderator"
        ADMINISTRATOR = "administrator", "Administrator"

    class MemberType(models.TextChoices):
        STUDENT = "student", "Student"
        FACULTY = "faculty", "Faculty"
        PERSONNEL = "personnel", "Non-teaching Personnel"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        SUSPENDED = "suspended", "Suspended"
        BANNED = "banned", "Banned"

    email = models.EmailField(
        "RTU email address",
        unique=True,
        db_index=True,
        help_text="Official RTU email, for example 0000-000000@rtu.edu.ph.",
    )
    display_name = models.CharField(max_length=120)
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.VISITOR,
        db_index=True,
    )

    # AV-04: student, faculty, or non-teaching personnel; college/office; year.
    member_type = models.CharField(
        max_length=20,
        choices=MemberType.choices,
        default=MemberType.STUDENT,
    )
    college = models.ForeignKey(
        College,
        verbose_name="College / Institute / Office",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="members",
        help_text="One row per college, institute or office — not free text.",
    )
    year_level = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(6)],
        help_text="Required for students. Leave blank for faculty and personnel.",
    )
    contact_number = models.CharField(
        max_length=20,
        blank=True,
        validators=[
            RegexValidator(
                regex=r"^\+?[0-9 ]{7,20}$",
                message="Enter a contact number using digits only (optional +63).",
            )
        ],
        help_text="Shown to the other party only while an order is in progress.",
    )
    profile_photo = models.ImageField(
        upload_to="avatars/%Y/%m/",
        blank=True,
        null=True,
    )

    # AD-01: administrators activate, suspend, and reactivate accounts.
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True,
    )
    status_note = models.TextField(blank=True)
    status_changed_at = models.DateTimeField(null=True, blank=True)
    status_changed_by = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="status_changes_made",
        help_text="The administrator who last changed this account's status.",
    )

    # AV-03: the account becomes verified only after the email link is used.
    verified_at = models.DateTimeField(null=True, blank=True)

    is_active = models.BooleanField(
        default=True,
        help_text="Unselect to block the account from signing in.",
    )
    is_staff = models.BooleanField(
        default=False,
        help_text="Grants access to the Django admin site.",
    )
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "email"
    EMAIL_FIELD = "email"
    REQUIRED_FIELDS = ["display_name"]

    class Meta:
        verbose_name = "user"
        verbose_name_plural = "users"
        ordering = ["-date_joined"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(year_level__isnull=True)
                | models.Q(year_level__gte=1, year_level__lte=6),
                name="accounts_year_level_between_1_and_6",
            )
        ]

    def __str__(self) -> str:
        return f"{self.display_name} <{self.email}>"

    def __init__(self, *args, **kwargs):
        # Fixtures and older call sites pass a college name as a string. Defer
        # resolution to save(), because the FK descriptor rejects a string at
        # assignment time. The API never takes this path: RegisterSerializer
        # resolves strictly and rejects unknown values.
        raw = kwargs.get("college")
        if isinstance(raw, str):
            kwargs["college"] = None
        super().__init__(*args, **kwargs)
        if isinstance(raw, str):
            self._pending_college_text = raw

    def save(self, *args, **kwargs):
        self.email = normalize_email(self.email)
        if self.display_name:
            self.display_name = self.display_name.strip()
        pending = getattr(self, "_pending_college_text", None)
        if pending and self.college_id is None:
            self.college = College.resolve_or_create(pending)
            self._pending_college_text = None
        super().save(*args, **kwargs)

    def clean(self):
        super().clean()
        self.email = normalize_email(self.email)
        validate_rtu_email(self.email, self.member_type)

        if self.member_type == self.MemberType.STUDENT and self.year_level is None:
            raise ValidationError({"year_level": "Year level is required for students."})
        if self.member_type != self.MemberType.STUDENT and self.year_level is not None:
            raise ValidationError({"year_level": "Only students have a year level."})

    # -- Convenience properties used across the API and templates ----------

    @property
    def is_verified(self) -> bool:
        return self.verified_at is not None

    @property
    def is_rtu_member(self) -> bool:
        return self.is_verified and self.role != self.Role.VISITOR

    @property
    def is_office_staff(self) -> bool:
        return self.role in {self.Role.OFFICE_STAFF, self.Role.ADMINISTRATOR}

    @property
    def is_moderator(self) -> bool:
        return self.role in {self.Role.MODERATOR, self.Role.ADMINISTRATOR}

    @property
    def is_administrator(self) -> bool:
        return self.role == self.Role.ADMINISTRATOR or self.is_superuser

    @property
    def can_sign_in(self) -> bool:
        return self.is_active and self.status == self.Status.ACTIVE

    def verify(self):
        """Mark the account verified and promote a visitor to verified user."""
        if self.verified_at is not None:
            return
        self.verified_at = timezone.now()
        if self.role == self.Role.VISITOR:
            self.role = self.Role.USER
        self.save(update_fields=["verified_at", "role"])

    def get_full_name(self) -> str:
        return self.display_name

    def get_short_name(self) -> str:
        return self.display_name.split(" ")[0] if self.display_name else self.email


class VerificationCode(models.Model):
    """The 6-digit code emailed at sign-up (AV-03, code-based flow).

    Only a hash is stored. One row per account: asking for a new code replaces
    the old one, so an interrupted sign-up cannot leave two valid codes.
    """

    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="verification_code"
    )
    code_hash = models.CharField(max_length=128)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    sent_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "verification code"
        verbose_name_plural = "verification codes"

    def __str__(self) -> str:
        return f"Code for {self.user.email}"


class PasswordResetCode(models.Model):
    """The 6-digit code emailed when a password is forgotten (AV-06).

    Kept apart from `VerificationCode` on purpose: a live sign-up code and a
    live reset code must not overwrite each other, and the two flows expire on
    different clocks. One row per account, replaced on every request, hash
    only — same rules as the sign-up code.
    """

    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="password_reset_code"
    )
    code_hash = models.CharField(max_length=128)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    sent_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "password reset code"
        verbose_name_plural = "password reset codes"

    def __str__(self) -> str:
        return f"Password reset code for {self.user.email}"


class TokenActivity(models.Model):
    """SE-05: when a sign-in token was last used.

    The token itself records only when it was issued, which cannot tell a
    session that is open from one that was abandoned three hours ago. One row
    per token, touched at most once a minute, so "30 minutes of no activity"
    is a fact about use rather than a guess about age.

    A ladder of two limits, not one: `AUTH_IDLE_MINUTES` ends a session that
    stopped being used, and `AUTH_TOKEN_TTL_DAYS` is still the outer bound for
    a session that is used forever.
    """

    token = models.OneToOneField(
        "authtoken.Token",
        on_delete=models.CASCADE,
        related_name="activity",
    )
    last_seen = models.DateTimeField(db_index=True)

    class Meta:
        verbose_name_plural = "token activity"

    def __str__(self):
        return f"token for user {self.token.user_id} at {self.last_seen:%Y-%m-%d %H:%M}"


class LoginAttempt(models.Model):
    """Failed login attempt counter used for login lockout (SE-05).

    Keyed by email (lowercased) rather than by user so that an address that
    does not exist behaves the same as a real one — nobody can probe which
    accounts exist.  The row is never created for successful logins; it only
    accumulates on failure and is cleared by :func:`reset` on success or
    password reset.
    """

    email = models.EmailField(
        "email address",
        unique=True,
        db_index=True,
        help_text="Login address that failed, stored lowercased.",
    )
    failed_count = models.PositiveSmallIntegerField(default=0)
    last_failed_at = models.DateTimeField(null=True, blank=True)
    locked_until = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "login attempt"
        verbose_name_plural = "login attempts"
        ordering = ["-updated_at"]

    def __str__(self) -> str:
        return f"Login attempts for {self.email}: {self.failed_count}"
