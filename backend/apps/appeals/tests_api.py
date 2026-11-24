"""AI-06 and RM-08: the appeal, and the people who are not allowed to judge it."""

from decimal import Decimal

from django.utils import timezone

from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.audit.models import AuditLog
from apps.catalog.models import Category, Listing
from apps.forum.models import ForumComment, ForumPost
from apps.notifications.models import Notification

from .models import Appeal


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


class AppealTests(APITestCase):
    def setUp(self):
        self.seller = make_user("2024-700001@rtu.edu.ph")
        self.bystander = make_user("2024-700002@rtu.edu.ph")
        self.moderator = make_user("2024-700003@rtu.edu.ph", role=User.Role.MODERATOR)
        self.other_moderator = make_user("2024-700004@rtu.edu.ph", role=User.Role.MODERATOR)
        self.category = Category.objects.create(name="Gadgets")
        self.listing = Listing.objects.create(
            seller=self.seller,
            category=self.category,
            title="Graphics card",
            description="Barely used.",
            listing_type=Listing.Type.PRODUCT,
            condition=Listing.Condition.USED,
            price=Decimal("4000.00"),
            quantity=1,
            meetup_place="Main lobby",
            moderation_status=Listing.ModerationStatus.REJECTED,
            availability_status=Listing.AvailabilityStatus.AVAILABLE,
        )

    def file(self, kind="listing", reason="The item is a legitimate calculator, not a weapon.", **extra):
        payload = {"kind": kind, "reason": reason, **extra}
        if kind == "listing":
            payload.setdefault("listing", self.listing.id)
        return self.client.post("/api/v1/appeals/", payload, format="json")

    # --- filing -----------------------------------------------------------

    def test_the_owner_may_appeal_a_rejected_listing(self):
        self.client.force_authenticate(self.seller)

        response = self.file()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.json())
        self.assertEqual(response.json()["status"], "pending")
        self.assertEqual(response.json()["target_label"], "Graphics card")

    def test_a_stranger_may_not_appeal_it(self):
        self.client.force_authenticate(self.bystander)

        response = self.file()

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("your own listing", str(response.json()))

    def test_an_approved_listing_has_nothing_to_appeal(self):
        self.listing.moderation_status = Listing.ModerationStatus.APPROVED
        self.listing.save(update_fields=["moderation_status"])
        self.client.force_authenticate(self.seller)

        response = self.file()

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("not been rejected", str(response.json()))

    def test_a_two_word_reason_is_refused(self):
        self.client.force_authenticate(self.seller)

        response = self.file(reason="unfair")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Write a sentence", str(response.json()))

    def test_a_second_open_appeal_about_the_same_thing_is_refused(self):
        self.client.force_authenticate(self.seller)
        self.file()

        again = self.file()

        self.assertEqual(again.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already have an appeal", str(again.json()))
        self.assertEqual(Appeal.objects.count(), 1)

    # --- deciding ---------------------------------------------------------

    def test_another_moderator_grants_it_and_the_listing_returns(self):
        self.client.force_authenticate(self.seller)
        appeal_id = self.file().json()["id"]

        self.client.force_authenticate(self.other_moderator)
        decided = self.client.post(
            f"/api/v1/appeals/{appeal_id}/decide/",
            {"grant": True, "note": "Checked the photos: it is a calculator."},
            format="json",
        )

        self.assertEqual(decided.status_code, status.HTTP_200_OK, decided.json())
        self.assertEqual(decided.json()["status"], "granted")
        self.listing.refresh_from_db()
        self.assertEqual(self.listing.moderation_status, Listing.ModerationStatus.APPROVED)
        self.assertTrue(
            AuditLog.objects.filter(action="appeal.granted", target_id=str(appeal_id)).exists()
        )
        self.assertTrue(
            Notification.objects.filter(user=self.seller, text__startswith="Your appeal was granted.")
            .exists()
        )

    def test_the_original_decider_cannot_review_it(self):
        post = ForumPost.objects.create(
            author=self.seller, topic="General", title="Odd post", body="Words."
        )
        post.hidden_by = self.moderator
        post.hidden_at = timezone.now()
        post.save(update_fields=["hidden_by", "hidden_at"])
        self.client.force_authenticate(self.seller)
        appeal_id = self.file(kind="post", post=post.id).json()["id"]

        self.client.force_authenticate(self.moderator)
        refused = self.client.post(
            f"/api/v1/appeals/{appeal_id}/decide/",
            {"grant": True, "note": "Let it back."},
            format="json",
        )

        self.assertEqual(refused.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cannot review the appeal", str(refused.json()))

    def test_nobody_decides_their_own_appeal(self):
        self.moderator2 = make_user("2024-700005@rtu.edu.ph", role=User.Role.MODERATOR)
        listing = Listing.objects.create(
            seller=self.moderator2,
            category=self.category,
            title="Keyboard",
            description="Used once.",
            listing_type=Listing.Type.PRODUCT,
            condition=Listing.Condition.USED,
            price=Decimal("900.00"),
            quantity=1,
            meetup_place="Main lobby",
            moderation_status=Listing.ModerationStatus.REJECTED,
            availability_status=Listing.AvailabilityStatus.AVAILABLE,
        )
        self.client.force_authenticate(self.moderator2)
        appeal_id = self.client.post(
            "/api/v1/appeals/",
            {"kind": "listing", "listing": listing.id, "reason": "It is a plain keyboard."},
            format="json",
        ).json()["id"]

        refused = self.client.post(
            f"/api/v1/appeals/{appeal_id}/decide/",
            {"grant": True, "note": "Fine."},
            format="json",
        )

        self.assertEqual(refused.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("your own appeal", str(refused.json()))

    def test_a_decision_without_a_reason_is_refused(self):
        self.client.force_authenticate(self.seller)
        appeal_id = self.file().json()["id"]

        self.client.force_authenticate(self.other_moderator)
        refused = self.client.post(
            f"/api/v1/appeals/{appeal_id}/decide/",
            {"grant": False, "note": ""},
            format="json",
        )

        self.assertEqual(refused.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Give a reason", str(refused.json()))

    def test_a_denial_leaves_the_listing_alone_and_tells_the_seller_why(self):
        self.client.force_authenticate(self.seller)
        appeal_id = self.file().json()["id"]

        self.client.force_authenticate(self.other_moderator)
        self.client.post(
            f"/api/v1/appeals/{appeal_id}/decide/",
            {"grant": False, "note": "The description still claims an unlicensed item."},
            format="json",
        )

        self.listing.refresh_from_db()
        self.assertEqual(self.listing.moderation_status, Listing.ModerationStatus.REJECTED)
        notice = Notification.objects.filter(user=self.seller).latest("created_at")
        self.assertTrue(notice.text.startswith("Your appeal was refused."))
        self.assertIn("unlicensed item", notice.text)

    def test_a_decided_appeal_cannot_be_decided_again(self):
        self.client.force_authenticate(self.seller)
        appeal_id = self.file().json()["id"]
        self.client.force_authenticate(self.other_moderator)
        self.client.post(
            f"/api/v1/appeals/{appeal_id}/decide/",
            {"grant": True, "note": "Restored."},
            format="json",
        )

        again = self.client.post(
            f"/api/v1/appeals/{appeal_id}/decide/",
            {"grant": False, "note": "Changed my mind."},
            format="json",
        )

        self.assertEqual(again.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already been decided", str(again.json()))

    def test_a_member_cannot_decide_anything(self):
        self.client.force_authenticate(self.seller)
        appeal_id = self.file().json()["id"]

        refused = self.client.post(
            f"/api/v1/appeals/{appeal_id}/decide/",
            {"grant": True, "note": "I say so."},
            format="json",
        )

        self.assertEqual(refused.status_code, status.HTTP_403_FORBIDDEN)

    # --- visibility -------------------------------------------------------

    def test_a_member_sees_only_their_own_appeals_and_staff_see_the_queue(self):
        self.client.force_authenticate(self.seller)
        self.file()
        self.client.force_authenticate(self.moderator)
        mine = rows(self.client.get("/api/v1/appeals/"))
        self.assertEqual(len(mine), 1)

        self.client.force_authenticate(self.bystander)
        theirs = rows(self.client.get("/api/v1/appeals/"))
        self.assertEqual(theirs, [])

    def test_a_suspension_can_be_appealed_and_is_lifted_when_granted(self):
        suspended = make_user(
            "2024-700006@rtu.edu.ph", status=User.Status.SUSPENDED, is_active=False
        )
        # A suspended account cannot sign in, so the appeal comes from the
        # public endpoint with the credentials it already has.
        self.client.force_authenticate(None)
        filed = self.client.post(
            "/api/v1/appeals/suspension/",
            {
                "email": "2024-700006@rtu.edu.ph",
                "password": "SecurePass123!",
                "reason": "I never posted anything that broke a rule.",
            },
            format="json",
        )
        self.assertEqual(filed.status_code, status.HTTP_201_CREATED, filed.json())

        self.client.force_authenticate(self.other_moderator)
        self.client.post(
            f"/api/v1/appeals/{filed.json()['id']}/decide/",
            {"grant": True, "note": "The report named a different account."},
            format="json",
        )

        suspended.refresh_from_db()
        self.assertEqual(suspended.status, User.Status.ACTIVE)
        self.assertTrue(suspended.is_active)

    def test_an_active_account_has_no_suspension_to_appeal(self):
        self.client.force_authenticate(None)

        response = self.client.post(
            "/api/v1/appeals/suspension/",
            {
                "email": "2024-700001@rtu.edu.ph",
                "password": "SecurePass123!",
                "reason": "Nothing happened to me, but here we are.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("not suspended", str(response.json()))

    def test_a_wrong_password_and_an_unknown_address_answer_alike(self):
        self.client.force_authenticate(None)
        suspended = make_user(
            "2024-700007@rtu.edu.ph", status=User.Status.SUSPENDED, is_active=False
        )

        wrong = self.client.post(
            "/api/v1/appeals/suspension/",
            {"email": suspended.email, "password": "not-it", "reason": "Let me back, please."},
            format="json",
        )
        unknown = self.client.post(
            "/api/v1/appeals/suspension/",
            {"email": "nobody@rtu.edu.ph", "password": "not-it", "reason": "Let me back, please."},
            format="json",
        )

        self.assertEqual(wrong.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(wrong.json(), unknown.json())

    def test_a_ban_is_not_appealed_here(self):
        make_user("2024-700008@rtu.edu.ph", status=User.Status.BANNED, is_active=False)
        self.client.force_authenticate(None)

        response = self.client.post(
            "/api/v1/appeals/suspension/",
            {
                "email": "2024-700008@rtu.edu.ph",
                "password": "SecurePass123!",
                "reason": "I would like this looked at.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("banned", str(response.json()))
