"""API tests for buyer ↔ seller messaging."""

from decimal import Decimal

from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.catalog.models import Category, Listing
from apps.audit.models import AuditLog
from apps.messaging.models import Conversation, Message
from apps.notifications.models import Notification


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


class ConversationReportTests(APITestCase):
    """MS-04 and MS-05: report a thread, and let a moderator read only what was reported."""

    def setUp(self):
        self.buyer = make_user("2024-222001@rtu.edu.ph")
        self.seller = make_user("2024-222002@rtu.edu.ph")
        self.moderator = make_user("2024-222003@rtu.edu.ph", role=User.Role.MODERATOR)
        self.outsider = make_user("2024-222004@rtu.edu.ph")
        self.category = Category.objects.create(name="Gadgets")
        self.listing = Listing.objects.create(
            seller=self.seller,
            category=self.category,
            title="USB drive",
            description="32 GB.",
            listing_type=Listing.Type.PRODUCT,
            condition=Listing.Condition.USED,
            price=Decimal("200.00"),
            quantity=1,
            meetup_place="Main lobby",
            moderation_status=Listing.ModerationStatus.APPROVED,
            availability_status=Listing.AvailabilityStatus.AVAILABLE,
        )
        self.client.force_authenticate(self.buyer)
        opened = self.client.post(
            "/api/v1/conversations/",
            {"seller_email": self.seller.email, "listing": self.listing.slug},
            format="json",
        )
        self.assertEqual(opened.status_code, status.HTTP_201_CREATED, opened.json())
        self.conversation_id = opened.json()["id"]
        self.thread = Conversation.objects.get(pk=self.conversation_id)
        self.before = Message.objects.create(
            conversation=self.thread, sender=self.buyer, body="Private: my number is 0917."
        )
        self.offending = Message.objects.create(
            conversation=self.thread,
            sender=self.seller,
            body="Pay me GCash first or no meetup.",
        )
        self.after = Message.objects.create(
            conversation=self.thread, sender=self.buyer, body="That is not allowed here."
        )

    def report(self, message=None, reason="off_platform", **extra):
        payload = {"reason": reason, "details": extra.pop("details", "Asked for GCash."), **extra}
        if message is not None:
            payload["message"] = message.id
        return self.client.post(
            f"/api/v1/conversations/{self.conversation_id}/report/", payload, format="json"
        )

    def test_a_participant_may_report_one_message(self):
        self.client.force_authenticate(self.buyer)

        response = self.report(self.offending)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.json())
        self.assertEqual(response.json()["status"], "received")
        self.assertEqual(response.json()["reason_display"], "Payment outside the platform")

    def test_a_non_participant_cannot_report(self):
        self.client.force_authenticate(self.outsider)

        response = self.report(self.offending)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_you_cannot_report_your_own_message(self):
        self.client.force_authenticate(self.buyer)

        response = self.report(self.before)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("your own message", str(response.json()))

    def test_the_same_message_cannot_be_reported_twice_while_open(self):
        self.client.force_authenticate(self.buyer)
        self.report(self.offending)

        again = self.report(self.offending)

        self.assertEqual(again.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already reported", str(again.json()))

    def test_the_queue_shows_only_the_reported_message(self):
        self.client.force_authenticate(self.buyer)
        self.report(self.offending)

        self.client.force_authenticate(self.moderator)
        rows = self.client.get("/api/v1/message-reports/?status=open").json()
        rows = rows["results"] if isinstance(rows, dict) else rows
        self.assertEqual(len(rows), 1)

        row = rows[0]
        self.assertEqual(row["reported_messages"][0]["body"], "Pay me GCash first or no meetup.")
        serialized = str(row)
        self.assertNotIn("Private: my number", serialized)
        self.assertNotIn("That is not allowed here.", serialized)
        self.assertNotIn("messages", row)  # no thread key at all

    def test_the_reported_person_cannot_see_the_report(self):
        self.client.force_authenticate(self.buyer)
        self.report(self.offending)

        self.client.force_authenticate(self.seller)
        rows = self.client.get("/api/v1/message-reports/").json()
        rows = rows["results"] if isinstance(rows, dict) else rows
        self.assertEqual(rows, [])

    def test_a_stranger_does_not_see_the_seller_reported(self):
        self.client.force_authenticate(self.buyer)
        self.report(self.offending)

        # The report's existence is not announced to the person reported.
        self.assertFalse(
            Notification.objects.filter(
                user=self.seller, text__contains="reported"
            ).exists()
        )

    def test_the_sender_is_told_nothing_until_a_warning_is_issued(self):
        self.client.force_authenticate(self.buyer)
        report_id = self.report(self.offending).json()["id"]

        self.client.force_authenticate(self.moderator)
        self.client.post(
            f"/api/v1/message-reports/{report_id}/resolve/",
            {"action": "warn", "note": "Asking for GCash before a meetup is not allowed here."},
            format="json",
        )

        notice = Notification.objects.filter(user=self.seller, kind="report").latest("created_at")
        self.assertIn("warning", notice.text)
        self.assertIn("not allowed here", notice.text)

    def test_a_warning_marks_the_report_actioned_and_audits_it(self):
        self.client.force_authenticate(self.buyer)
        report_id = self.report(self.offending).json()["id"]

        self.client.force_authenticate(self.moderator)
        decided = self.client.post(
            f"/api/v1/message-reports/{report_id}/resolve/",
            {"action": "warn", "note": "Off-platform payment."},
            format="json",
        )

        self.assertEqual(decided.status_code, status.HTTP_200_OK, decided.json())
        self.assertEqual(decided.json()["status"], "resolved")
        self.assertEqual(decided.json()["resolution"], "actioned")
        self.assertTrue(
            AuditLog.objects.filter(action="conversation.report.warn").exists()
        )

    def test_a_dismissal_needs_no_note_and_closes_quietly(self):
        self.client.force_authenticate(self.buyer)
        report_id = self.report(self.offending).json()["id"]

        self.client.force_authenticate(self.moderator)
        decided = self.client.post(
            f"/api/v1/message-reports/{report_id}/resolve/",
            {"action": "dismiss"},
            format="json",
        )

        self.assertEqual(decided.status_code, status.HTTP_200_OK)
        self.assertEqual(decided.json()["status"], "resolved")
        self.assertEqual(decided.json()["resolution"], "dismissed")
        self.assertTrue(
            Notification.objects.filter(
                user=self.buyer, text__contains="dismissed"
            ).exists()
        )

    def test_a_suspension_takes_the_account_out(self):
        self.client.force_authenticate(self.buyer)
        report_id = self.report(self.offending).json()["id"]

        self.client.force_authenticate(self.moderator)
        self.client.post(
            f"/api/v1/message-reports/{report_id}/resolve/",
            {"action": "suspend", "note": "Repeated off-platform payment demands."},
            format="json",
        )

        self.seller.refresh_from_db()
        self.assertEqual(self.seller.status, User.Status.SUSPENDED)

    def test_a_member_cannot_handle_a_report(self):
        self.client.force_authenticate(self.buyer)
        report_id = self.report(self.offending).json()["id"]

        refused = self.client.post(
            f"/api/v1/message-reports/{report_id}/resolve/",
            {"action": "dismiss"},
            format="json",
        )

        self.assertEqual(refused.status_code, status.HTTP_403_FORBIDDEN)

    def test_the_reporter_cannot_decide_their_own_report(self):
        moderator_buyer = make_user("2024-222005@rtu.edu.ph", role=User.Role.MODERATOR)
        conversation = Conversation.objects.create(
            listing=self.listing, buyer=moderator_buyer, seller=self.seller
        )
        Message.objects.create(
            conversation=conversation, sender=self.seller, body="Send GCash now."
        )
        self.client.force_authenticate(moderator_buyer)
        filed = self.client.post(
            f"/api/v1/conversations/{conversation.id}/report/",
            {"reason": "off_platform"},
            format="json",
        )
        self.assertEqual(filed.status_code, status.HTTP_201_CREATED, filed.json())

        refused = self.client.post(
            f"/api/v1/message-reports/{filed.json()['id']}/resolve/",
            {"action": "dismiss"},
            format="json",
        )

        self.assertEqual(refused.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("report you filed", str(refused.json()))

    def test_a_thread_report_carries_no_message_text(self):
        self.client.force_authenticate(self.buyer)

        response = self.report(None, details="He keeps pushing me to pay outside the app.")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.json())
        self.assertTrue(response.json()["is_thread_report"])
        self.assertEqual(response.json()["reported_messages"], [])
