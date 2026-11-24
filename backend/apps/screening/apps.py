from django.apps import AppConfig


class ScreeningConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.screening"
    verbose_name = "Content screening"

    def ready(self):
        from . import signals  # noqa: F401  (connects the cache invalidation)
