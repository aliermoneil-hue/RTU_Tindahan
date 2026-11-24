"""AI-10: an edited rule is live on the next item, not on the next minute."""

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import ScreeningRule
from .rules import invalidate


@receiver(post_save, sender=ScreeningRule)
def _rule_saved(sender, instance, **kwargs):
    invalidate()


@receiver(post_delete, sender=ScreeningRule)
def _rule_deleted(sender, instance, **kwargs):
    invalidate()
