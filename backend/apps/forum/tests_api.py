"""API tests for forum posts, comments, reactions, and reports."""

import base64
import shutil
import tempfile
from decimal import Decimal

from django.test import override_settings
from datetime import timedelta

from django.utils import timezone
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


# Pin the provider: `load_dotenv()` puts the machine's `LLM_PROVIDER` into
# settings, and a live model in the proxy would make every post here wait on
# the network — or come back held — so the suite would answer differently on
# each machine.
@override_settings(
    MEDIA_ROOT=MEDIA_ROOT,
    SCREENING_PROVIDER="stub",
    SCREENING_FALLBACK=True,
)
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

    def test_a_notice_notifies_members_and_lists_as_a_notice(self):
        self.client.force_authenticate(self.moderator)
        created = self.client.post(
            "/api/v1/forum/posts/",
            {"kind": "notice", "title": "Enrollment", "body": "Opens Monday."},
            format="json",
        )

        self.assertEqual(created.status_code, status.HTTP_201_CREATED)

        notices = self.client.get("/api/v1/forum/posts/?kind=notice")
        self.assertEqual(len(rows(notices)), 1)
        self.assertEqual(rows(notices)[0]["kind"], "notice")

        from apps.notifications.models import Notification

        self.assertTrue(
            Notification.objects.filter(
                user=self.other, kind="announcement", link_kind="post"
            ).exists()
        )
        self.assertFalse(Notification.objects.filter(user=self.moderator).exists())


@override_settings(SCREENING_PROVIDER="stub", SCREENING_FALLBACK=True)
class ForumScreeningApiTests(APITestCase):
    """AI-03 on the forum: a flagged post waits for a moderator (see docs/SCREENING.md)."""

    def setUp(self):
        self.author = make_user("2024-911111@rtu.edu.ph")
        self.other = make_user("2024-922222@rtu.edu.ph")
        self.moderator = make_user("2024-933333@rtu.edu.ph", role=User.Role.MODERATOR)

    def post(self, author=None, title="Study group", body="Meet at the library on Friday.", **extra):
        self.client.force_authenticate(author or self.author)
        payload = {"kind": "post", "topic": "General", "title": title, "body": body}
        payload.update(extra)
        return self.client.post("/api/v1/forum/posts/", payload, format="json")

    def feed(self, user=None, **params):
        self.client.force_authenticate(user)
        return rows(self.client.get("/api/v1/forum/posts/", params))

    def test_a_flagged_post_is_held_out_of_the_public_feed(self):
        response = self.post(
            title="Selling answer keys",
            body="Complete exam answers for the midterm. Message me.",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        post_id = response.json()["id"]
        self.assertEqual(response.json()["moderation_status"], "needs_review")

        self.assertEqual(self.feed(), [])
        self.assertEqual(self.feed(self.other), [])
        # The author is not left guessing: their own row still comes back.
        mine = [row["id"] for row in self.feed(self.author)]
        self.assertIn(post_id, mine)
        # Staff see it in the same list they moderate from.
        self.assertIn(post_id, [row["id"] for row in self.feed(self.moderator)])

    def test_an_ordinary_post_is_public_at_once(self):
        response = self.post()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()["moderation_status"], "visible")
        self.assertEqual(len(self.feed()), 1)

    def test_only_staff_read_the_screening_reasons(self):
        self.post(
            title="Selling answer keys",
            body="Complete exam answers for the midterm. Message me.",
        )

        staff_row = self.feed(self.moderator)[0]
        self.assertEqual(staff_row["screening"]["verdict"], "rejected")
        self.assertTrue(staff_row["screening"]["reasons"])
        self.assertEqual(staff_row["screening"]["provider"], "stub")

        self.client.force_authenticate(self.author)
        author_row = self.client.get(f"/api/v1/forum/posts/{staff_row['id']}/").json()
        self.assertIsNone(author_row["screening"])
        self.assertEqual(author_row["moderation_status"], "needs_review")

    def test_a_moderator_restore_clears_the_hold(self):
        post_id = self.post(
            title="Selling answer keys",
            body="Complete exam answers for the midterm. Message me.",
        ).json()["id"]

        self.client.force_authenticate(self.moderator)
        response = self.client.post(
            f"/api/v1/forum/posts/{post_id}/moderate/", {"action": "restore"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["moderation_status"], "visible")
        self.assertEqual(len(self.feed()), 1)

    def test_the_queue_filter_and_its_error(self):
        held_id = self.post(
            title="Selling answer keys",
            body="Complete exam answers for the midterm. Message me.",
        ).json()["id"]
        self.post(title="Ordinary question", body="Where is room 305?")

        self.client.force_authenticate(self.moderator)
        queue = rows(self.client.get("/api/v1/forum/posts/", {"moderation": "needs_review"}))
        self.assertEqual([row["id"] for row in queue], [held_id])

        # A visitor cannot use the parameter to reach a held post.
        self.client.force_authenticate(None)
        self.assertEqual(
            rows(self.client.get("/api/v1/forum/posts/", {"moderation": "needs_review"})), []
        )

        self.client.force_authenticate(self.moderator)
        bad = self.client.get("/api/v1/forum/posts/", {"moderation": "banana"})
        self.assertEqual(bad.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Unknown moderation status", error_text(bad))

    def test_an_edit_is_screened_again(self):
        post_id = self.post(title="A normal post", body="Nothing to see here.").json()["id"]
        self.assertEqual(len(self.feed()), 1)

        self.client.force_authenticate(self.author)
        response = self.client.patch(
            f"/api/v1/forum/posts/{post_id}/",
            {"body": "Actually, selling answer keys for the final exam."},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["moderation_status"], "needs_review")
        self.assertEqual(self.feed(), [])

    def test_a_held_notice_does_not_notify_the_campus(self):
        response = self.post(
            author=self.moderator,
            kind="notice",
            title="Selling shabu",
            body="Message me for prices, delivery at the gate.",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()["moderation_status"], "needs_review")

        from apps.notifications.models import Notification

        self.assertFalse(
            Notification.objects.filter(
                user=self.other, kind=Notification.Kind.ANNOUNCEMENT
            ).exists()
        )


@override_settings(SCREENING_PROVIDER="stub", SCREENING_FALLBACK=True)
class ForumCommentScreeningApiTests(APITestCase):
    """AI-03: a comment that trips the gate waits for a moderator."""

    def setUp(self):
        self.author = make_user("2024-944444@rtu.edu.ph")
        self.other = make_user("2024-955555@rtu.edu.ph")
        self.moderator = make_user("2024-966666@rtu.edu.ph", role=User.Role.MODERATOR)

    def make_post(self):
        self.client.force_authenticate(self.author)
        return self.client.post(
            "/api/v1/forum/posts/",
            {"kind": "post", "topic": "General", "title": "Reviewer", "body": "Notes inside."},
            format="json",
        ).json()["id"]

    def comment(self, post_id, text, author=None):
        self.client.force_authenticate(author or self.author)
        return self.client.post(
            f"/api/v1/forum/posts/{post_id}/comments/", {"text": text}, format="json"
        )

    def read_post(self, post_id, user=None):
        self.client.force_authenticate(user)
        return self.client.get(f"/api/v1/forum/posts/{post_id}/").json()

    def test_a_flagged_comment_is_held_out_of_the_thread(self):
        post_id = self.make_post()

        response = self.comment(post_id, "Selling answer keys for the final, 300 pesos.")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()["moderation_status"], "needs_review")

        # Another member reads the thread: the comment is not there.
        theirs = self.read_post(post_id, self.other)
        self.assertEqual(theirs["comments"], [])
        self.assertEqual(theirs["comment_count"], 0)
        # Its author still sees it, so it did not vanish without explanation.
        mine = self.read_post(post_id, self.author)
        self.assertEqual(len(mine["comments"]), 1)
        self.assertEqual(mine["comments"][0]["moderation_status"], "needs_review")
        # Staff see it with the reason.
        staff = self.read_post(post_id, self.moderator)
        self.assertEqual(staff["comments"][0]["screening"]["verdict"], "rejected")

    def test_an_ordinary_comment_is_public_at_once(self):
        post_id = self.make_post()
        self.comment(post_id, "Interested, where do we meet?")

        theirs = self.read_post(post_id, self.other)

        self.assertEqual(len(theirs["comments"]), 1)
        self.assertEqual(theirs["comment_count"], 1)
        self.assertEqual(theirs["comments"][0]["moderation_status"], "visible")
        self.assertIsNone(theirs["comments"][0]["screening"])

    def test_a_moderator_restore_releases_the_comment(self):
        post_id = self.make_post()
        comment_id = self.comment(
            post_id, "Selling answer keys for the final, 300 pesos."
        ).json()["id"]

        self.client.force_authenticate(self.moderator)
        response = self.client.post(
            f"/api/v1/forum/comments/{comment_id}/moderate/",
            {"action": "restore"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["moderation_status"], "visible")
        self.assertEqual(len(self.read_post(post_id, self.other)["comments"]), 1)

    def test_an_edit_is_screened_again(self):
        post_id = self.make_post()
        comment_id = self.comment(post_id, "Nice notes, thanks!").json()["id"]
        self.assertEqual(len(self.read_post(post_id, self.other)["comments"]), 1)

        self.client.force_authenticate(self.author)
        response = self.client.patch(
            f"/api/v1/forum/comments/{comment_id}/",
            {"text": "Actually, I am selling answer keys for the final."},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["moderation_status"], "needs_review")
        self.assertEqual(self.read_post(post_id, self.other)["comments"], [])


class SellingSchedulePostTests(APITestCase):
    """CF-05: a Selling schedule post is an appointment, and the server says so."""

    def setUp(self):
        self.user = make_user("2024-333001@rtu.edu.ph")
        self.client.force_authenticate(self.user)

    def post(self, **payload):
        body = {"topic": "Selling schedule", "title": "Selling this Saturday", "body": "Come by."}
        body.update(payload)
        return self.client.post("/api/v1/forum/posts/", body, format="json")

    def test_a_schedule_without_a_date_is_refused(self):
        response = self.post(event_start="14:00", event_place="Main lobby")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("a date", str(response.json()))

    def test_a_schedule_without_a_place_is_refused(self):
        tomorrow = (timezone.localdate() + timedelta(days=1)).isoformat()
        response = self.post(event_date=tomorrow, event_start="14:00")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("a campus location", str(response.json()))

    def test_a_schedule_in_the_past_is_refused(self):
        yesterday = (timezone.localdate() - timedelta(days=1)).isoformat()
        response = self.post(
            event_date=yesterday, event_start="14:00", event_place="Main lobby"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cannot be set in the past", str(response.json()))

    def test_an_end_time_before_the_start_is_refused(self):
        tomorrow = (timezone.localdate() + timedelta(days=1)).isoformat()
        response = self.post(
            event_date=tomorrow,
            event_start="16:00",
            event_end="14:00",
            event_place="Main lobby",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("end time must be after", str(response.json()))

    def test_a_complete_schedule_is_published_and_read_back(self):
        tomorrow = (timezone.localdate() + timedelta(days=1)).isoformat()
        created = self.post(
            event_date=tomorrow,
            event_start="14:00",
            event_end="16:00",
            event_place="Main lobby, beside the guard house",
        )

        self.assertEqual(created.status_code, status.HTTP_201_CREATED, created.json())
        body = self.client.get(f"/api/v1/forum/posts/{created.json()['id']}/").json()
        self.assertEqual(body["topic"], "Selling schedule")
        self.assertEqual(body["event_date"], tomorrow)
        self.assertEqual(body["event_start"], "14:00:00")
        self.assertEqual(body["event_end"], "16:00:00")
        self.assertEqual(body["event_place"], "Main lobby, beside the guard house")

    def test_a_discussion_post_still_needs_no_appointment(self):
        response = self.post(topic="General", title="Anyone selling a calculator?")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.json())
        self.assertIsNone(response.json()["event_date"])
        self.assertEqual(response.json()["event_place"], "")


class ListingAndUserReportTests(APITestCase):
    """RM-01: a listing or a member can be reported, on the same queue as a post."""

    def setUp(self):
        self.seller = make_user("2024-444001@rtu.edu.ph")
        self.reporter = make_user("2024-444002@rtu.edu.ph")
        self.moderator = make_user("2024-444003@rtu.edu.ph", role=User.Role.MODERATOR)
        self.category = Category.objects.create(name="Services")
        self.listing = Listing.objects.create(
            seller=self.seller,
            category=self.category,
            title="Thesis editing service",
            description="I will rewrite your thesis overnight, guaranteed approval.",
            listing_type=Listing.Type.SERVICE,
            condition=Listing.Condition.USED,
            price=Decimal("1500.00"),
            quantity=1,
            meetup_place="Main lobby",
            moderation_status=Listing.ModerationStatus.APPROVED,
            availability_status=Listing.AvailabilityStatus.AVAILABLE,
        )

    def report(self, **payload):
        self.client.force_authenticate(self.reporter)
        return self.client.post("/api/v1/forum/reports/", payload, format="json")

    def test_a_listing_can_be_reported_with_its_text_snapshotted(self):
        response = self.report(
            type="listing",
            listing=self.listing.slug,
            reason="Academic cheating",
            details="Offers to write the whole thesis.",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.json())
        body = response.json()
        self.assertEqual(body["type"], "listing")
        self.assertEqual(body["listing"], self.listing.slug)
        self.assertEqual(body["snapshot_title"], "Thesis editing service")
        self.assertIn("rewrite your thesis", body["snapshot_text"])

    def test_a_seller_cannot_report_their_own_listing(self):
        self.client.force_authenticate(self.seller)

        response = self.client.post(
            "/api/v1/forum/reports/",
            {"type": "listing", "listing": self.listing.slug, "reason": "Mine"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("your own listing", str(response.json()))

    def test_the_reported_seller_does_not_see_the_report(self):
        self.report(type="listing", listing=self.listing.slug, reason="Academic cheating")

        self.client.force_authenticate(self.seller)
        rows = self.client.get("/api/v1/forum/reports/").json()
        rows = rows["results"] if isinstance(rows, dict) else rows
        self.assertEqual(rows, [])

    def test_staff_see_the_listing_report_in_the_queue(self):
        self.report(type="listing", listing=self.listing.slug, reason="Academic cheating")

        self.client.force_authenticate(self.moderator)
        rows = self.client.get("/api/v1/forum/reports/?type=listing").json()
        rows = rows["results"] if isinstance(rows, dict) else rows
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["target_name"] or rows[0]["snapshot_title"], "Thesis editing service")

    def test_a_member_can_be_reported_without_naming_the_reporter_to_them(self):
        response = self.report(
            type="user",
            reported_user=self.seller.email,
            reason="Harassment",
            details="Kept messaging after I asked them to stop.",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.json())
        self.assertEqual(response.json()["reported_user"], self.seller.id)

        self.client.force_authenticate(self.seller)
        mine = self.client.get("/api/v1/forum/reports/").json()
        mine = mine["results"] if isinstance(mine, dict) else mine
        self.assertEqual(mine, [])

    def test_you_cannot_report_yourself(self):
        self.client.force_authenticate(self.seller)

        response = self.client.post(
            "/api/v1/forum/reports/",
            {"type": "user", "reported_user": self.seller.email, "reason": "Me"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("report yourself", str(response.json()))

    def test_a_listing_report_without_a_listing_is_refused(self):
        response = self.report(type="listing", reason="Something")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Choose the listing", str(response.json()))

    def test_a_user_report_without_a_member_is_refused(self):
        response = self.report(type="user", reason="Something")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Choose the member", str(response.json()))


class ReviewReportTests(APITestCase):
    """RM-01: a review can be reported too, by anyone but its author."""

    def setUp(self):
        self.seller = make_user("2024-555001@rtu.edu.ph")
        self.buyer = make_user("2024-555002@rtu.edu.ph")
        self.other = make_user("2024-555003@rtu.edu.ph")
        self.category = Category.objects.create(name="Gadgets")

    def make_review(self, buyer):
        from apps.orders.models import Order
        from apps.reviews.models import Review

        order = Order.objects.create(
            reference=f"ORD-T90{Order.objects.count() + 1:03d}",
            buyer=buyer,
            seller=self.seller,
            status=Order.Status.COMPLETED,
            meetup_place="Main lobby",
        )
        return Review.objects.create(
            order=order,
            buyer=buyer,
            seller=self.seller,
            stars=1,
            text="Seller never showed up and kept the money.",
        )

    def test_a_review_can_be_reported_with_its_words_snapshotted(self):
        review = self.make_review(self.buyer)
        self.client.force_authenticate(self.other)

        response = self.client.post(
            "/api/v1/forum/reports/",
            {"type": "review", "review": review.id, "reason": "Misleading"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.json())
        self.assertEqual(response.json()["review"], review.id)
        self.assertEqual(response.json()["snapshot_title"], "1-star review")
        self.assertIn("never showed up", response.json()["snapshot_text"])

    def test_you_cannot_report_your_own_review(self):
        review = self.make_review(self.buyer)
        self.client.force_authenticate(self.buyer)

        response = self.client.post(
            "/api/v1/forum/reports/",
            {"type": "review", "review": review.id, "reason": "Mine"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("your own review", str(response.json()))
