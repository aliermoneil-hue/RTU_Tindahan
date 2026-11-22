"""API tests for buyer ↔ seller messaging."""

from decimal import Decimal

from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.catalog.models import Category, Listing
from apps.messaging.models import Conversation, Message


def make_user(email, **extra):
    user = User.objects.create_user(
        email=email,
        display_name=email.split("@")[0],
        password="SecurePass123!",
        member_type=User.MemberType.STUDENT,
        college="College of ICT",
        year_level=2,
        **extra,
    )
    user.verify()
    return user


class MessagingApiTests(APITestCase):
    def setUp(self):
        self.seller = make_user("2024-111111@rtu.edu.ph")
        self.buyer = make_user("2024-222222@rtu.edu.ph")
        self.stranger = make_user("2024-333333@rtu.edu.ph")
        category = Category.objects.create(name="Gadgets")
        self.listing = Listing.objects.create(
            seller=self.seller,
            category=category,
            title="Secondhand Calculator",
            description="All keys working.",
            listing_type=Listing.Type.PRODUCT,
            condition=Listing.Condition.USED,
            price=Decimal("350.00"),
            quantity=1,
            meetup_place="Main lobby",
            moderation_status=Listing.ModerationStatus.APPROVED,
            availability_status=Listing.AvailabilityStatus.AVAILABLE,
        )

    def open_thread(self):
        self.client.force_authenticate(self.buyer)
        return self.client.post(
            "/api/v1/conversations/",
            {"seller_email": self.seller.email, "listing": self.listing.slug},
            format="json",
        )

    def test_a_buyer_opens_a_thread_and_the_seller_sees_it(self):
        response = self.open_thread()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        body = response.json()
        self.assertEqual(body["buyer_email"], self.buyer.email)
        self.assertEqual(body["seller_email"], self.seller.email)
        self.assertEqual(body["listing_slug"], self.listing.slug)
        self.assertEqual(body["messages"], [])

        self.client.force_authenticate(self.seller)
        listed = self.client.get("/api/v1/conversations/")

        self.assertEqual(listed.json()["count"], 1)
        self.assertEqual(listed.json()["results"][0]["id"], body["id"])

    def test_opening_the_same_thread_twice_reuses_it(self):
        first = self.open_thread().json()
        second = self.open_thread().json()

        self.assertEqual(first["id"], second["id"])
        self.assertEqual(Conversation.objects.count(), 1)

    def test_a_seller_can_open_the_thread_with_their_buyer(self):
        self.open_thread()

        self.client.force_authenticate(self.seller)
        response = self.client.post(
            "/api/v1/conversations/",
            {"buyer_email": self.buyer.email},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Conversation.objects.count(), 1)

    def test_naming_both_or_neither_person_is_rejected(self):
        self.client.force_authenticate(self.buyer)

        neither = self.client.post("/api/v1/conversations/", {}, format="json")
        both = self.client.post(
            "/api/v1/conversations/",
            {"seller_email": self.seller.email, "buyer_email": self.stranger.email},
            format="json",
        )

        self.assertEqual(neither.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(both.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Conversation.objects.count(), 0)

    def test_you_cannot_message_yourself(self):
        self.client.force_authenticate(self.seller)
        response = self.client.post(
            "/api/v1/conversations/",
            {"seller_email": self.seller.email},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_messages_cross_between_the_two_sides(self):
        conversation_id = self.open_thread().json()["id"]

        sent = self.client.post(
            f"/api/v1/conversations/{conversation_id}/messages/",
            {"body": "Is this still available?"},
            format="json",
        )
        self.assertEqual(sent.status_code, status.HTTP_201_CREATED)

        self.client.force_authenticate(self.seller)
        inbox = self.client.get(f"/api/v1/conversations/{conversation_id}/").json()
        self.assertEqual(inbox["unread"], 1)
        self.assertEqual(inbox["messages"][0]["body"], "Is this still available?")

        reply = self.client.post(
            f"/api/v1/conversations/{conversation_id}/messages/",
            {"body": "Yes, meet at the lobby."},
            format="json",
        )
        self.assertEqual(reply.status_code, status.HTTP_201_CREATED)

        self.client.force_authenticate(self.buyer)
        thread = self.client.get(f"/api/v1/conversations/{conversation_id}/").json()
        self.assertEqual(len(thread["messages"]), 2)
        self.assertEqual(thread["messages"][1]["sender_email"], self.seller.email)
        self.assertEqual(thread["unread"], 1)

    def test_marking_read_clears_the_badge(self):
        conversation_id = self.open_thread().json()["id"]
        self.client.post(
            f"/api/v1/conversations/{conversation_id}/messages/",
            {"body": "Hello"},
            format="json",
        )

        self.client.force_authenticate(self.seller)
        marked = self.client.post(f"/api/v1/conversations/{conversation_id}/read/")

        self.assertEqual(marked.status_code, status.HTTP_200_OK)
        self.assertEqual(marked.json()["unread"], 0)
        self.assertEqual(Message.objects.filter(read_at__isnull=False).count(), 1)

    def test_a_stranger_cannot_open_the_thread(self):
        conversation_id = self.open_thread().json()["id"]

        self.client.force_authenticate(self.stranger)
        response = self.client.get(f"/api/v1/conversations/{conversation_id}/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_an_empty_message_is_rejected(self):
        conversation_id = self.open_thread().json()["id"]

        response = self.client.post(
            f"/api/v1/conversations/{conversation_id}/messages/",
            {"body": "   "},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Message.objects.count(), 0)

    def test_a_signed_out_visitor_sees_no_threads(self):
        self.client.force_authenticate(None)
        response = self.client.get("/api/v1/conversations/")

        self.assertIn(
            response.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )
