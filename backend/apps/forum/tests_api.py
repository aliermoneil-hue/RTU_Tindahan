"""API tests for forum posts, comments, reactions, and reports."""

import base64
import shutil
import tempfile
from decimal import Decimal

from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.catalog.models import Category, Listing
from apps.orders.models import Order

from .models import ForumComment, ForumPost, ForumReaction, ForumReport

MEDIA_ROOT = tempfile.mkdtemp(prefix="forum-test-")


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


def error_text(response):
    data = response.json()
    if isinstance(data, dict):
        for value in data.values():
            if isinstance(value, list) and value:
                return str(value[0])
            if isinstance(value, str):
                return value
    return str(data)


def pixel_data_url():
    # 1x1 transparent PNG.
    raw = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk"
        "YPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
    )
    return "data:image/png;base64," + base64.b64encode(raw).decode()


@override_settings(MEDIA_ROOT=MEDIA_ROOT)
class ForumApiTests(APITestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA_ROOT, ignore_errors=True)

    def setUp(self):
        self.author = make_user("2024-111111@rtu.edu.ph")
        self.other = make_user("2024-222222@rtu.edu.ph")
        self.moderator = make_user("2024-333333@rtu.edu.ph", role=User.Role.MODERATOR)
        self.category = Category.objects.create(name="General")
        self.listing = Listing.objects.create(
            seller=self.author,
            category=self.category,
            title="Reviewer",
            description="Notes.",
            listing_type=Listing.Type.PRODUCT,
            condition=Listing.Condition.USED,
            price=Decimal("100.00"),
            quantity=2,
            meetup_place="Main lobby",
            moderation_status=Listing.ModerationStatus.APPROVED,
            availability_status=Listing.AvailabilityStatus.AVAILABLE,
        )

    def post(self, title="Looking for a study group", body="Meet at the library.", **extra):
        self.client.force_authenticate(self.author)
        payload = {"kind": "post", "topic": "General", "title": title, "body": body}
        payload.update(extra)
        return self.client.post("/api/v1/forum/posts/", payload, format="json")

    def test_a_member_can_post_and_the_feed_is_public(self):
        response = self.post()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        body = response.json()
        self.assertEqual(body["title"], "Looking for a study group")
        self.assertEqual(body["author_name"], "2024-111111")
        self.assertTrue(body["is_mine"])
        self.assertEqual(body["comments"], [])

        self.client.force_authenticate(None)
        feed = self.client.get("/api/v1/forum/posts/")
        self.assertEqual(feed.status_code, status.HTTP_200_OK)
        self.assertEqual(len(rows(feed)), 1)
        self.assertFalse(rows(feed)[0]["is_mine"])

    def test_an_empty_post_is_refused(self):
        response = self.post(title="", body="")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Write something", error_text(response))

    def test_a_signed_out_visitor_cannot_post(self):
        self.client.force_authenticate(None)
        response = self.client.post(
            "/api/v1/forum/posts/", {"title": "Hi", "body": "There"}, format="json"
        )

        self.assertIn(
            response.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )

    def test_only_staff_may_post_a_notice(self):
        refused = self.post(kind="notice")
        self.assertEqual(refused.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.moderator)
        allowed = self.client.post(
            "/api/v1/forum/posts/",
            {"kind": "notice", "title": "Enrollment", "body": "Opens Monday."},
            format="json",
        )
        self.assertEqual(allowed.status_code, status.HTTP_201_CREATED)
        self.assertEqual(allowed.json()["kind"], "notice")

    def test_a_comment_and_a_reply_land_in_the_post(self):
        post_id = self.post().json()["id"]

        self.client.force_authenticate(self.other)
        comment = self.client.post(
            f"/api/v1/forum/posts/{post_id}/comments/", {"text": "I am in."}, format="json"
        )
        self.assertEqual(comment.status_code, status.HTTP_201_CREATED)

        reply = self.client.post(
            f"/api/v1/forum/posts/{post_id}/comments/",
            {"text": "Same here.", "parent": comment.json()["id"]},
            format="json",
        )
        self.assertEqual(reply.status_code, status.HTTP_201_CREATED)
        self.assertEqual(reply.json()["parent"], comment.json()["id"])

        post = self.client.get(f"/api/v1/forum/posts/{post_id}/").json()
        self.assertEqual(post["comment_count"], 2)
        self.assertEqual(len(post["comments"]), 2)

    def test_a_reply_must_belong_to_the_same_post(self):
        first = self.post(title="First").json()["id"]
        second = self.post(title="Second").json()["id"]
        comment = self.client.post(
            f"/api/v1/forum/posts/{first}/comments/", {"text": "Hello"}, format="json"
        ).json()

        response = self.client.post(
            f"/api/v1/forum/posts/{second}/comments/",
            {"text": "Wrong thread", "parent": comment["id"]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_the_author_edits_and_a_stranger_cannot(self):
        post_id = self.post().json()["id"]

        updated = self.client.patch(
            f"/api/v1/forum/posts/{post_id}/",
            {"title": "Updated title"},
            format="json",
        )
        self.assertEqual(updated.status_code, status.HTTP_200_OK)
        self.assertEqual(updated.json()["title"], "Updated title")
        self.assertIsNotNone(updated.json()["edited_at"])

        self.client.force_authenticate(self.other)
        refused = self.client.patch(
            f"/api/v1/forum/posts/{post_id}/", {"title": "Hijack"}, format="json"
        )
        self.assertEqual(refused.status_code, status.HTTP_403_FORBIDDEN)

    def test_a_reaction_toggles_changes_and_clears(self):
        post_id = self.post().json()["id"]

        self.client.force_authenticate(self.other)
        first = self.client.post(
            f"/api/v1/forum/posts/{post_id}/react/", {"key": "like"}, format="json"
        )
        self.assertEqual(first.json()["my_reaction"], "like")
        self.assertEqual(first.json()["react_counts"], {"like": 1})

        changed = self.client.post(
            f"/api/v1/forum/posts/{post_id}/react/", {"key": "love"}, format="json"
        )
        self.assertEqual(changed.json()["my_reaction"], "love")
        self.assertEqual(changed.json()["react_counts"], {"love": 1})

        cleared = self.client.post(
            f"/api/v1/forum/posts/{post_id}/react/", {"key": "love"}, format="json"
        )
        self.assertIsNone(cleared.json()["my_reaction"])
        self.assertEqual(cleared.json()["react_counts"], {})
        self.assertFalse(ForumReaction.objects.exists())

    def test_a_hidden_post_leaves_the_public_feed_but_not_its_author(self):
        post_id = self.post().json()["id"]

        self.client.force_authenticate(self.moderator)
        hidden = self.client.post(
            f"/api/v1/forum/posts/{post_id}/moderate/", {"action": "hide"}, format="json"
        )
        self.assertEqual(hidden.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(hidden.json()["hidden"])

        self.client.force_authenticate(None)
        self.assertEqual(rows(self.client.get("/api/v1/forum/posts/")), [])

        self.client.force_authenticate(self.author)
        self.assertEqual(len(rows(self.client.get("/api/v1/forum/posts/"))), 1)

        self.client.force_authenticate(self.moderator)
        restored = self.client.post(
            f"/api/v1/forum/posts/{post_id}/moderate/", {"action": "restore"}, format="json"
        )
        self.assertIsNone(restored.json()["hidden"])

    def test_a_hidden_post_cannot_be_edited(self):
        post_id = self.post().json()["id"]
        self.client.force_authenticate(self.moderator)
        self.client.post(
            f"/api/v1/forum/posts/{post_id}/moderate/", {"action": "hide"}, format="json"
        )

        self.client.force_authenticate(self.author)
        response = self.client.patch(
            f"/api/v1/forum/posts/{post_id}/", {"title": "Sneaky"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_a_moderator_can_pin_and_delete_a_post(self):
        post_id = self.post().json()["id"]

        self.client.force_authenticate(self.moderator)
        pinned = self.client.post(
            f"/api/v1/forum/posts/{post_id}/moderate/", {"action": "pin"}, format="json"
        )
        self.assertTrue(pinned.json()["pinned"])

        removed = self.client.delete(f"/api/v1/forum/posts/{post_id}/")
        self.assertEqual(removed.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(ForumPost.objects.exists())

    def test_a_comment_with_replies_is_soft_deleted(self):
        post_id = self.post().json()["id"]
        self.client.force_authenticate(self.other)
        parent = self.client.post(
            f"/api/v1/forum/posts/{post_id}/comments/", {"text": "Parent"}, format="json"
        ).json()
        self.client.post(
            f"/api/v1/forum/posts/{post_id}/comments/",
            {"text": "Reply", "parent": parent["id"]},
            format="json",
        )

        removed = self.client.delete(f"/api/v1/forum/comments/{parent['id']}/")

        self.assertEqual(removed.status_code, status.HTTP_204_NO_CONTENT)
        comment = ForumComment.objects.get(pk=parent["id"])
        self.assertTrue(comment.is_deleted)
        self.assertEqual(comment.text, "")
        self.assertEqual(ForumComment.objects.filter(post_id=post_id).count(), 2)

    def test_a_leaf_comment_is_removed(self):
        post_id = self.post().json()["id"]
        self.client.force_authenticate(self.other)
        comment = self.client.post(
            f"/api/v1/forum/posts/{post_id}/comments/", {"text": "Leaf"}, format="json"
        ).json()

        self.client.delete(f"/api/v1/forum/comments/{comment['id']}/")

        self.assertFalse(ForumComment.objects.filter(pk=comment["id"]).exists())

    def test_the_author_edits_a_comment(self):
        post_id = self.post().json()["id"]
        self.client.force_authenticate(self.other)
        comment = self.client.post(
            f"/api/v1/forum/posts/{post_id}/comments/", {"text": "Typo"}, format="json"
        ).json()

        updated = self.client.patch(
            f"/api/v1/forum/comments/{comment['id']}/", {"text": "Fixed"}, format="json"
        )

        self.assertEqual(updated.status_code, status.HTTP_200_OK)
        self.assertEqual(updated.json()["text"], "Fixed")

    def test_a_moderator_hides_a_comment(self):
        post_id = self.post().json()["id"]
        self.client.force_authenticate(self.other)
        comment = self.client.post(
            f"/api/v1/forum/posts/{post_id}/comments/", {"text": "Rude"}, format="json"
        ).json()

        self.client.force_authenticate(self.moderator)
        hidden = self.client.post(
            f"/api/v1/forum/comments/{comment['id']}/moderate/", {"action": "hide"}, format="json"
        )

        self.assertEqual(hidden.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(hidden.json()["hidden"])
        self.client.force_authenticate(None)
        post = self.client.get(f"/api/v1/forum/posts/{post_id}/").json()
        self.assertEqual(post["comment_count"], 0)

    def test_reporting_a_post_is_private_and_not_repeatable(self):
        post_id = self.post().json()["id"]

        self.client.force_authenticate(self.other)
        report = self.client.post(
            "/api/v1/forum/reports/",
            {"type": "post", "post": post_id, "reason": "Spam or advertising", "details": "Ads"},
            format="json",
        )
        self.assertEqual(report.status_code, status.HTTP_201_CREATED)
        self.assertEqual(report.json()["status"], "open")
        self.assertTrue(report.json()["is_mine"])

        again = self.client.post(
            "/api/v1/forum/reports/",
            {"type": "post", "post": post_id, "reason": "Something else"},
            format="json",
        )
        self.assertEqual(again.status_code, status.HTTP_400_BAD_REQUEST)

        mine = rows(self.client.get("/api/v1/forum/reports/"))
        self.assertEqual(len(mine), 1)

        self.client.force_authenticate(self.author)
        self.assertEqual(rows(self.client.get("/api/v1/forum/reports/")), [])

        self.client.force_authenticate(self.moderator)
        self.assertEqual(len(rows(self.client.get("/api/v1/forum/reports/"))), 1)

    def test_you_cannot_report_your_own_content(self):
        post_id = self.post().json()["id"]

        response = self.client.post(
            "/api/v1/forum/reports/",
            {"type": "post", "post": post_id, "reason": "Something else"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("your own content", error_text(response))

    def test_reporting_a_comment_names_the_post(self):
        post_id = self.post().json()["id"]
        self.client.force_authenticate(self.other)
        comment = self.client.post(
            f"/api/v1/forum/posts/{post_id}/comments/", {"text": "Target"}, format="json"
        ).json()

        self.client.force_authenticate(self.author)
        response = self.client.post(
            "/api/v1/forum/reports/",
            {
                "type": "comment",
                "post": post_id,
                "comment": comment["id"],
                "reason": "Harassment or bullying",
                "details": "It targets a student.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ForumReport.objects.get().comment_id, comment["id"])

    def test_resolving_with_hide_hides_the_content_and_closes_open_reports(self):
        post_id = self.post().json()["id"]
        self.client.force_authenticate(self.other)
        report_id = self.client.post(
            "/api/v1/forum/reports/",
            {"type": "post", "post": post_id, "reason": "Spam or advertising"},
            format="json",
        ).json()["id"]

        self.client.force_authenticate(self.moderator)
        resolved = self.client.post(
            f"/api/v1/forum/reports/{report_id}/resolve/",
            {"status": "actioned", "action": "hide", "note": "Looks like spam."},
            format="json",
        )

        self.assertEqual(resolved.status_code, status.HTTP_200_OK)
        self.assertEqual(resolved.json()["status"], "actioned")
        self.assertEqual(resolved.json()["action"], "hide")
        self.assertTrue(ForumPost.objects.get(pk=post_id).is_hidden)

    def test_a_member_cannot_resolve_a_report(self):
        post_id = self.post().json()["id"]
        self.client.force_authenticate(self.other)
        report_id = self.client.post(
            "/api/v1/forum/reports/",
            {"type": "post", "post": post_id, "reason": "Spam or advertising"},
            format="json",
        ).json()["id"]

        response = self.client.post(
            f"/api/v1/forum/reports/{report_id}/resolve/",
            {"status": "dismissed"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_an_order_report_requires_being_a_participant(self):
        order = Order.objects.create(
            reference="ORD-261123-009",
            buyer=self.other,
            seller=self.author,
            status=Order.Status.COMPLETED,
        )

        self.client.force_authenticate(self.moderator)
        refused = self.client.post(
            "/api/v1/forum/reports/",
            {
                "type": "order",
                "order": order.reference,
                "reason": "Buyer did not show up at meetup (waited a long time)",
                "details": "Waited an hour.",
            },
            format="json",
        )
        self.assertEqual(refused.status_code, status.HTTP_400_BAD_REQUEST)

        self.client.force_authenticate(self.other)
        allowed = self.client.post(
            "/api/v1/forum/reports/",
            {
                "type": "order",
                "order": order.reference,
                "reason": "Buyer did not show up at meetup (waited a long time)",
                "details": "Waited an hour.",
            },
            format="json",
        )
        self.assertEqual(allowed.status_code, status.HTTP_201_CREATED)
        self.assertEqual(allowed.json()["order"], order.reference)

    def test_a_post_photo_is_stored_and_served_as_a_url(self):
        response = self.post(images=[pixel_data_url()])

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        images = response.json()["images"]
        self.assertEqual(len(images), 1)
        self.assertIn("/media/forum/", images[0])
        self.assertTrue(images[0].startswith("http"))

    def test_a_bad_photo_is_refused(self):
        response = self.post(images=["not-a-data-url"])

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("data URL", error_text(response))
