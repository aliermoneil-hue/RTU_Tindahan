"""Emission and inbox tests for notifications."""

from decimal import Decimal

from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.catalog.models import Category, Listing, ListingVariant
from apps.forum.models import ForumPost, ForumReport
from apps.messaging.models import Conversation
from apps.notifications.models import Notification
from apps.orders.models import Order, OrderLine
from apps.reviews.models import Review
from apps.store.models import OfficialTicket
from apps.store.services import change_ticket_status, place_official_order, record_stock_in


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


def rows(response):
    data = response.json()
    return data["results"] if isinstance(data, dict) and "results" in data else data


class NotificationApiTests(APITestCase):
    def setUp(self):
        self.seller = make_user("2024-111111@rtu.edu.ph")
        self.buyer = make_user("2024-222222@rtu.edu.ph")
        self.moderator = make_user("2024-333333@rtu.edu.ph", role=User.Role.MODERATOR)
        self.staff = make_user("2024-444444@rtu.edu.ph", role=User.Role.OFFICE_STAFF)
        self.category = Category.objects.create(name="Gadgets")
        self.listing = Listing.objects.create(
            seller=self.seller,
            category=self.category,
            title="Secondhand Calculator",
            description="All keys working.",
            listing_type=Listing.Type.PRODUCT,
            condition=Listing.Condition.USED,
            price=Decimal("350.00"),
            quantity=3,
            meetup_place="Main lobby",
            moderation_status=Listing.ModerationStatus.APPROVED,
            availability_status=Listing.AvailabilityStatus.AVAILABLE,
        )

    def request_order(self):
        self.client.force_authenticate(self.buyer)
        return self.client.post(
            "/api/v1/orders/",
            {"lines": [{"listing": self.listing.pk, "quantity": 1}]},
            format="json",
        )

    def test_placing_an_order_notifies_the_seller(self):
        reference = self.request_order().json()["reference"]

        inbox = Notification.objects.filter(user=self.seller)
        self.assertEqual(inbox.count(), 1)
        row = inbox.get()
        self.assertEqual(row.kind, Notification.Kind.ORDER)
        self.assertIn("requested", row.text)
        self.assertEqual(row.link_kind, "shop")
        self.assertEqual(row.link_id, reference)
        self.assertEqual(row.actor, self.buyer)
        self.assertFalse(Notification.objects.filter(user=self.buyer).exists())

    def test_accepting_notifies_the_buyer(self):
        reference = self.request_order().json()["reference"]
        self.client.force_authenticate(self.seller)
        self.client.post(
            f"/api/v1/orders/{reference}/transition/", {"status": "accepted"}, format="json"
        )

        row = Notification.objects.filter(user=self.buyer).get()
        self.assertIn("accepted", row.text)
        self.assertEqual(row.link_kind, "order")
        self.assertEqual(row.link_id, reference)

    def test_a_buyer_cancel_notifies_the_seller(self):
        reference = self.request_order().json()["reference"]
        self.client.force_authenticate(self.buyer)
        self.client.post(
            f"/api/v1/orders/{reference}/transition/", {"status": "cancelled"}, format="json"
        )

        row = Notification.objects.filter(user=self.seller).latest("created_at")
        self.assertIn("cancelled", row.text)
        self.assertEqual(row.link_kind, "shop")

    def test_a_message_notifies_the_other_side(self):
        conversation = Conversation.objects.create(buyer=self.buyer, seller=self.seller)

        self.client.force_authenticate(self.buyer)
        self.client.post(
            f"/api/v1/conversations/{conversation.pk}/messages/",
            {"body": "Is this still available?"},
            format="json",
        )

        row = Notification.objects.filter(user=self.seller).get()
        self.assertEqual(row.kind, Notification.Kind.MESSAGE)
        self.assertEqual(row.link_kind, "message")
        self.assertEqual(row.link_id, f"cv-{conversation.pk}")
        self.assertFalse(Notification.objects.filter(user=self.buyer).exists())

    def test_a_comment_notifies_the_post_author_and_a_reply_notifies_the_parent(self):
        post = ForumPost.objects.create(author=self.seller, title="Study group", body="Library.")
        third = make_user("2024-555555@rtu.edu.ph")

        self.client.force_authenticate(self.buyer)
        first = self.client.post(
            f"/api/v1/forum/posts/{post.pk}/comments/", {"text": "I am in."}, format="json"
        ).json()
        self.assertEqual(
            Notification.objects.filter(user=self.seller, kind=Notification.Kind.COMMENT).count(), 1
        )

        self.client.force_authenticate(third)
        self.client.post(
            f"/api/v1/forum/posts/{post.pk}/comments/",
            {"text": "Same.", "parent": first["id"]},
            format="json",
        )

        # The post author hears about both the comment and the reply; the
        # parent author hears about the reply.
        self.assertEqual(
            Notification.objects.filter(user=self.buyer, kind=Notification.Kind.COMMENT).count(), 1
        )
        self.assertEqual(
            Notification.objects.filter(user=self.seller, kind=Notification.Kind.COMMENT).count(), 2
        )

    def test_a_report_notifies_staff_and_the_outcome_notifies_the_reporter(self):
        post = ForumPost.objects.create(author=self.seller, title="Spam", body="Buy now.")

        self.client.force_authenticate(self.buyer)
        report_id = self.client.post(
            "/api/v1/forum/reports/",
            {"type": "post", "post": post.pk, "reason": "Spam or advertising"},
            format="json",
        ).json()["id"]

        self.assertTrue(
            Notification.objects.filter(
                user=self.moderator, kind=Notification.Kind.REPORT, link_kind="freports"
            ).exists()
        )

        self.client.force_authenticate(self.moderator)
        self.client.post(
            f"/api/v1/forum/reports/{report_id}/resolve/",
            {"status": "dismissed"},
            format="json",
        )

        row = Notification.objects.filter(user=self.buyer).latest("created_at")
        self.assertIn("did not find a problem", row.text)

    def test_a_new_rating_notifies_the_seller_but_an_edit_does_not(self):
        order = Order.objects.create(
            reference="ORD-261123-010",
            buyer=self.buyer,
            seller=self.seller,
            status=Order.Status.COMPLETED,
        )
        OrderLine.objects.create(
            order=order, listing=self.listing, title=self.listing.title, quantity=1,
            unit_price=self.listing.price,
        )

        self.client.force_authenticate(self.buyer)
        self.client.post(
            "/api/v1/reviews/",
            {"order": order.reference, "stars": 5, "text": "Great."},
            format="json",
        )
        self.assertEqual(
            Notification.objects.filter(user=self.seller, kind=Notification.Kind.REVIEW).count(), 1
        )

        self.client.post(
            "/api/v1/reviews/",
            {"order": order.reference, "stars": 4, "text": "Edited."},
            format="json",
        )
        self.assertEqual(
            Notification.objects.filter(user=self.seller, kind=Notification.Kind.REVIEW).count(), 1
        )

    def test_listing_approval_notifies_the_seller(self):
        pending = Listing.objects.create(
            seller=self.seller,
            category=self.category,
            title="Pending item",
            description="Waiting.",
            listing_type=Listing.Type.PRODUCT,
            condition=Listing.Condition.USED,
            price=Decimal("100.00"),
            quantity=1,
            meetup_place="Main lobby",
        )

        self.client.force_authenticate(self.moderator)
        self.client.post(f"/api/v1/listings/{pending.slug}/approve/")

        row = Notification.objects.filter(user=self.seller, kind=Notification.Kind.LISTING).get()
        self.assertIn("now live", row.text)
        self.assertEqual(row.link_kind, "shop")

    def test_a_store_request_notifies_staff_and_a_transition_notifies_the_buyer(self):
        official = Listing.objects.create(
            seller=self.staff,
            category=self.category,
            title="Official Uniform",
            description="RTU uniform.",
            listing_type=Listing.Type.PRODUCT,
            condition=Listing.Condition.NEW,
            price=Decimal("500.00"),
            quantity=1,
            meetup_place="Store",
            moderation_status=Listing.ModerationStatus.APPROVED,
            availability_status=Listing.AvailabilityStatus.AVAILABLE,
            is_official=True,
        )
        variant = ListingVariant.objects.create(
            listing=official, name="Medium", price=Decimal("500.00")
        )
        record_stock_in(variant, 2, by=self.staff)

        ticket = place_official_order(
            buyer=self.buyer,
            items=[{"listing": official, "variant": variant, "quantity": 1}],
        )

        staff_row = Notification.objects.filter(user=self.staff).get()
        self.assertEqual(staff_row.kind, Notification.Kind.TICKET)
        self.assertEqual(staff_row.link_kind, "baoorders")

        change_ticket_status(ticket, OfficialTicket.Status.CONFIRMED, by=self.staff)

        buyer_row = Notification.objects.filter(user=self.buyer).latest("created_at")
        self.assertIn(ticket.reference, buyer_row.text)

    def test_the_inbox_is_private_filtered_and_markable(self):
        self.request_order()
        self.request_order()

        self.client.force_authenticate(self.seller)
        inbox = self.client.get("/api/v1/notifications/")
        self.assertEqual(len(rows(inbox)), 2)
        self.assertTrue(all(row["read"] is False for row in rows(inbox)))

        self.client.force_authenticate(self.buyer)
        self.assertEqual(rows(self.client.get("/api/v1/notifications/")), [])

        self.client.force_authenticate(self.seller)
        first_id = rows(inbox)[0]["id"]
        marked = self.client.post(
            "/api/v1/notifications/read/", {"ids": [first_id]}, format="json"
        )
        self.assertEqual(marked.json()["marked"], 1)
        self.assertEqual(len(rows(self.client.get("/api/v1/notifications/?unread=1"))), 1)

        all_read = self.client.post(
            "/api/v1/notifications/read/", {"all": True}, format="json"
        )
        self.assertEqual(all_read.json()["marked"], 1)
        self.assertEqual(rows(self.client.get("/api/v1/notifications/?unread=1")), [])

    def test_an_unverified_member_cannot_read_the_inbox(self):
        unverified = User.objects.create_user(
            email="2024-666666@rtu.edu.ph",
            display_name="unverified",
            password="SecurePass123!",
            member_type=User.MemberType.STUDENT,
            college="College of ICT",
            year_level=1,
        )

        self.client.force_authenticate(unverified)
        response = self.client.get("/api/v1/notifications/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
