from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator, RegexValidator
from django.db import models
from django.utils import timezone

from .managers import UserManager
from .validators import normalize_email, validate_rtu_email


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
    college = models.CharField(
        "College / Institute / Office",
        max_length=150,
        blank=True,
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

    def save(self, *args, **kwargs):
        self.email = normalize_email(self.email)
        if self.display_name:
            self.display_name = self.display_name.strip()
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
