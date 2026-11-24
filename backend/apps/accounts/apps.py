from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.accounts"
    verbose_name = "Accounts and roles"

    def ready(self):
        # PF-04: the SQLite pragmas are registered for every connection. The
        # import is the registration; see config/sqlite_pragmas.py.
        from config import sqlite_pragmas  # noqa: F401
