from django.contrib.auth.base_user import BaseUserManager


class UserManager(BaseUserManager):
    """Create users with an email address instead of a username."""

    use_in_migrations = True

    def _create_user(self, email: str, display_name: str, password: str | None, **extra):
        if not email:
            raise ValueError("An RTU email address is required.")
        if not display_name:
            raise ValueError("A display name is required.")

        email = self.normalize_email(email).lower()
        user = self.model(email=email, display_name=display_name, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email: str, display_name: str, password: str | None = None, **extra):
        extra.setdefault("role", "visitor")
        extra.setdefault("status", "active")
        return self._create_user(email, display_name, password, **extra)

    def create_superuser(self, email: str, display_name: str, password: str | None = None, **extra):
        extra.setdefault("role", "administrator")
        extra.setdefault("status", "active")
        extra.setdefault("member_type", "personnel")
        extra.setdefault("college", "Administration")
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)

        if extra.get("is_staff") is not True:
            raise ValueError("A superuser must have is_staff=True.")
        if extra.get("is_superuser") is not True:
            raise ValueError("A superuser must have is_superuser=True.")

        from django.utils import timezone

        extra.setdefault("verified_at", timezone.now())
        return self._create_user(email, display_name, password, **extra)
