from django.conf import settings
from django.db import models

from apps.catalog.models import Listing


class Conversation(models.Model):
    """One thread between one buyer and one seller, optionally about a listing."""

    listing = models.ForeignKey(
        Listing,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="conversations",
    )
    buyer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="conversations_as_buyer",
    )
    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="conversations_as_seller",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["buyer", "seller"], name="one_thread_per_buyer_and_seller"
            ),
            models.CheckConstraint(
                condition=~models.Q(buyer=models.F("seller")),
                name="conversation_buyer_is_not_seller",
            ),
        ]

    def __str__(self):
        return f"{self.buyer.email} ↔ {self.seller.email}"

    @property
    def last_message_at(self):
        last = self.messages.order_by("-created_at").first()
        return last.created_at if last else self.created_at

    def unread_for(self, user):
        return self.messages.filter(read_at__isnull=True).exclude(sender=user).count()


class Message(models.Model):
    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name="messages"
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="messages_sent",
    )
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return self.body[:40]
