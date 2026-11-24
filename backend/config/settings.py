"""
Django settings for the RTU Tindahan project.

Values that differ per machine or per deployment are read from backend/.env.
Copy .env.example to .env before running the project. The defaults below are
safe for local development only.

Reference: https://docs.djangoproject.com/en/5.2/topics/settings/
"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Load backend/.env (the file is gitignored).
load_dotenv(BASE_DIR / ".env")


def env_bool(name: str, default: bool = False) -> bool:
    """Read a boolean from the environment: 1/true/yes/on are True."""
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_list(name: str, default: str = "") -> list[str]:
    """Read a comma-separated list from the environment."""
    value = os.getenv(name, default)
    return [item.strip() for item in value.split(",") if item.strip()]


# ---------------------------------------------------------------------------
# Core
# ---------------------------------------------------------------------------

SECRET_KEY = os.getenv(
    "DJANGO_SECRET_KEY",
    "django-insecure-CHANGE-ME-in-dot-env-this-key-is-for-development-only",
)

DEBUG = env_bool("DJANGO_DEBUG", True)

ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")

# The React dev server. Used for CORS, CSRF, and verification email links.
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

CSRF_TRUSTED_ORIGINS = env_list("DJANGO_CSRF_TRUSTED_ORIGINS", FRONTEND_URL)

# Behind a TLS-terminating proxy (the Cloudflare tunnel, Tailscale serve) the
# request arrives over http and the proxy reports https in this header. Django
# has to trust it at all times, not only when DEBUG is off: otherwise
# build_absolute_uri() hands out http:// photo links, which an https frontend
# refuses to load as mixed content. Harmless locally, where the header is absent.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# ---------------------------------------------------------------------------
# Applications
# ---------------------------------------------------------------------------

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third party
    "rest_framework",
    "rest_framework.authtoken",
    "corsheaders",
    # Local apps
    "apps.accounts",
    "apps.catalog",
    "apps.screening",
    "apps.store",
    "apps.orders",
    "apps.messaging",
    "apps.favorites",
    "apps.reviews",
    "apps.forum",
    "apps.notifications",
    "apps.audit",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    # The API answers through a tunnel from a home connection: compress JSON
    # before it leaves so a listing feed costs a fraction of the bytes.
    "django.middleware.gzip.GZipMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# ---------------------------------------------------------------------------
# Database
#
# PostgreSQL is the approved stack. If POSTGRES_DB is not set (for example on
# a fresh clone before .env is created), fall back to SQLite so that
# `manage.py check` and the test suite run without a database server.
# ---------------------------------------------------------------------------

if os.getenv("POSTGRES_DB"):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.getenv("POSTGRES_DB"),
            "USER": os.getenv("POSTGRES_USER", ""),
            "PASSWORD": os.getenv("POSTGRES_PASSWORD", ""),
            "HOST": os.getenv("POSTGRES_HOST", "localhost"),
            "PORT": os.getenv("POSTGRES_PORT", "5432"),
            "CONN_MAX_AGE": 60,
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

# SE-05: a session expires after 30 minutes without activity.
SESSION_COOKIE_AGE = 60 * 30
SESSION_SAVE_EVERY_REQUEST = True

# SE-05: email verification links stay valid for 24 hours.
PASSWORD_RESET_TIMEOUT = 60 * 60 * 24

# ---------------------------------------------------------------------------
# Login lockout (failed attempt protection)
# ---------------------------------------------------------------------------
LOGIN_COOLDOWN_AFTER = int(os.getenv("LOGIN_COOLDOWN_AFTER", "5"))
LOGIN_COOLDOWN_SECONDS = int(os.getenv("LOGIN_COOLDOWN_SECONDS", "60"))
LOGIN_RESTRICT_AFTER = int(os.getenv("LOGIN_RESTRICT_AFTER", "7"))
LOGIN_RESTRICT_SECONDS = int(os.getenv("LOGIN_RESTRICT_SECONDS", "900"))
LOGIN_ATTEMPT_WINDOW_HOURS = int(os.getenv("LOGIN_ATTEMPT_WINDOW_HOURS", "24"))

# ---------------------------------------------------------------------------
# Django REST Framework
# ---------------------------------------------------------------------------

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        # AV-06 hardening: a token older than AUTH_TOKEN_TTL_DAYS is refused.
        # The format is unchanged, so the React client needed no edit.
        "apps.accounts.authentication.ExpiringTokenAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ]
    + (["rest_framework.renderers.BrowsableAPIRenderer"] if DEBUG else []),
    # SE-05: limit repeated failed log-ins and abusive sign-up calls.
    "DEFAULT_THROTTLE_RATES": {
        "login": os.getenv("THROTTLE_LOGIN", "30/min"),
        "register": os.getenv("THROTTLE_REGISTER", "10/hour"),
        "verify": os.getenv("THROTTLE_VERIFY", "20/hour"),
        "password-reset": os.getenv("THROTTLE_PASSWORD_RESET", "5/hour"),
        "login-status": os.getenv("THROTTLE_LOGIN_STATUS", "60/min"),
    },
}

# AV-06: how long a sign-in lasts. Zero disables the check (the old behaviour).
AUTH_TOKEN_TTL_DAYS = int(os.getenv("AUTH_TOKEN_TTL_DAYS", "14") or 0)

# PR-05: how long a finished record is kept. Two years is the working default;
# the SRS (Appendix B.2) leaves the number to the University, so it is a setting
# and not a constant. 0 disables the purge entirely.
DATA_RETENTION_DAYS = int(os.getenv("DATA_RETENTION_DAYS", "730") or 0)
# Read notifications are housekeeping, not records: they go after a quarter.
NOTIFICATION_RETENTION_DAYS = int(os.getenv("NOTIFICATION_RETENTION_DAYS", "90") or 0)

# ---------------------------------------------------------------------------
# CORS (the React app runs on a different port during development)
# ---------------------------------------------------------------------------

CORS_ALLOWED_ORIGINS = env_list(
    "DJANGO_CORS_ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
)
CORS_ALLOW_CREDENTIALS = True

# ---------------------------------------------------------------------------
# RTU identity rules
#
# Appendix B of the SRS still lists the official email format as "to confirm".
# These settings make the rule configurable without a code change.
# ---------------------------------------------------------------------------

RTU_EMAIL_DOMAIN = os.getenv("RTU_EMAIL_DOMAIN", "rtu.edu.ph")

# Students register with their student number in the local part.
RTU_STUDENT_EMAIL_REGEX = os.getenv(
    "RTU_STUDENT_EMAIL_REGEX",
    r"^(?P<student_number>\d{4}-\d{6})@rtu\.edu\.ph$",
)

# ---------------------------------------------------------------------------
# Content screening (AI-01 to AI-16)
#
# Which implementation answers is decided here, from backend/.env, and nowhere
# else: no request data can choose a provider. The key stays on the server and
# is never serialised to a client.
#
# `stub` is a deterministic rules provider, so the screening flow is testable
# before a real model is chosen. Naming a provider that does not exist raises
# at screening time, which sends the listing to a moderator rather than
# publishing it unchecked.
#
# Walkthrough: docs/SCREENING.md
# ---------------------------------------------------------------------------

SCREENING_PROVIDER = os.getenv("LLM_PROVIDER", "stub").strip().lower()
# `load_dotenv()` above puts the machine's provider into the suite, so a
# laptop with LLM_PROVIDER=gemini would make every listing test wait on the
# network — and answer differently from CI. Tests that want a real provider
# pin it themselves with @override_settings.
if "test" in sys.argv:
    SCREENING_PROVIDER = "stub"
    # 365 tests create accounts, and PBKDF2 at default work factor is most of
    # the suite's wall time (a 60-test app took two minutes alone). MD5 is the
    # documented Django speed-up for the test runner only: it changes nothing
    # about what is measured, and no test asserts a hash format.
    PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
SCREENING_API_KEY = os.getenv("LLM_API_KEY", "")

# Which model, and how long to wait for it. Kept in .env because providers
# retire model names without notice; a code change should not be needed.
SCREENING_MODEL = os.getenv("LLM_MODEL", "gemini-3.5-flash-lite").strip()
# Screening runs inline, so this is the member's worst-case wait when the
# provider is down. 6 s is long enough for a slow-but-working call.
SCREENING_TIMEOUT = float(os.getenv("LLM_TIMEOUT", "6"))

# When the provider fails, fall back to the deterministic rules instead of
# leaving the listing unscreened. Safe only because screening never publishes:
# a moderator still approves everything. See docs/SCREENING.md.
SCREENING_FALLBACK = env_bool("LLM_FALLBACK", True)

# ---------------------------------------------------------------------------
# Email
#
# Three modes, chosen with EMAIL_MODE in .env:
#
#   console   Local development. The message is printed in the runserver
#             terminal instead of being sent. No account needed.
#   mailtrap  Local development against the Mailtrap sandbox. Nothing reaches
#             a real inbox; the message appears in the Mailtrap web inbox.
#             Use it for repeated sign-up tests without spending the sending
#             account's daily quota.
#   gmail     Deployed backend. Real delivery through Gmail SMTP with an App
#             Password. This is the mode the deployed backend runs.
#
# Credentials are shared by both SMTP modes: EMAIL_HOST_USER and
# EMAIL_HOST_PASSWORD. Leave EMAIL_MODE empty to keep the older behaviour,
# where EMAIL_BACKEND and the EMAIL_HOST_* keys are read directly.
#
# Step-by-step walkthrough: docs/EMAIL-SETUP.md
# ---------------------------------------------------------------------------

EMAIL_MODE = os.getenv("EMAIL_MODE", "").strip().lower()

# Transport for each named mode. Anything not listed is read from .env.
EMAIL_TRANSPORTS = {
    "console": {
        "backend": "django.core.mail.backends.console.EmailBackend",
    },
    "mailtrap": {
        "backend": "django.core.mail.backends.smtp.EmailBackend",
        "host": "sandbox.smtp.mailtrap.io",
        "port": 2525,
        "use_tls": True,
    },
    "gmail": {
        "backend": "django.core.mail.backends.smtp.EmailBackend",
        "host": "smtp.gmail.com",
        "port": 587,
        "use_tls": True,
    },
}

_transport = EMAIL_TRANSPORTS.get(EMAIL_MODE)

if _transport:
    EMAIL_BACKEND = _transport["backend"]
    EMAIL_HOST = _transport.get("host", "")
    EMAIL_PORT = _transport.get("port", 587)
    EMAIL_USE_TLS = _transport.get("use_tls", True)
else:
    EMAIL_BACKEND = os.getenv(
        "EMAIL_BACKEND",
        "django.core.mail.backends.console.EmailBackend"
        if DEBUG
        else "django.core.mail.backends.smtp.EmailBackend",
    )
    EMAIL_HOST = os.getenv("EMAIL_HOST", "")
    EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
    EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", True)

EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")

# Gmail rejects a From address that is not the authenticated account, so the
# SMTP modes default the display address to that account. A team member who
# has a verified alias can still override DEFAULT_FROM_EMAIL in .env.
_DEFAULT_FROM = "RTU Tindahan <no-reply@rtu.edu.ph>"
if EMAIL_MODE in {"mailtrap", "gmail"} and EMAIL_HOST_USER:
    _DEFAULT_FROM = f"RTU Tindahan <{EMAIL_HOST_USER}>"

DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "").strip() or _DEFAULT_FROM

# ---------------------------------------------------------------------------
# Internationalization
# ---------------------------------------------------------------------------

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Manila"
USE_I18N = True
USE_TZ = True

# ---------------------------------------------------------------------------
# Static and media files
# ---------------------------------------------------------------------------

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

# SE-06: image uploads only, with a size ceiling (5 MB, matching the prototype).
MAX_UPLOAD_SIZE = 5 * 1024 * 1024
DATA_UPLOAD_MAX_MEMORY_SIZE = MAX_UPLOAD_SIZE

# "Small sellers" sort: a verified student with at most this many approved,
# available listings. One number, one place to change it.
SMALL_SELLER_MAX_LISTINGS = int(os.getenv("SMALL_SELLER_MAX_LISTINGS", "3"))

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------------------------------------------------------------------
# Nightly database copies (manage.py backup_database, docs/BACKUP.md)
#
# Outside the repository on purpose: a backup inside the working tree gets
# committed, copied into the deploy, or wiped by the next `git clean`.
# ---------------------------------------------------------------------------
BACKUP_DIR = os.getenv("BACKUP_DIR", "~/backups/tindahan")
BACKUP_KEEP = int(os.getenv("BACKUP_KEEP", "14"))

# ---------------------------------------------------------------------------
# Production hardening (only active when DEBUG is off)
# ---------------------------------------------------------------------------

if not DEBUG:
    SECURE_SSL_REDIRECT = env_bool("DJANGO_SECURE_SSL_REDIRECT", True)
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 60 * 60 * 24 * 30
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    # SECURE_PROXY_SSL_HEADER is set above, outside this block, so that photo
    # URLs stay https in the deployed build even while DEBUG is on.
    X_FRAME_OPTIONS = "DENY"
