"""Tests for the screening stub, the scrubbing, and the moderator queue.

Mapped to the SRS: AI-02 to AI-05, AI-07 to AI-12, AI-14, AI-15.
"""

from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.catalog.models import Category, Listing
from apps.screening import services
from apps.screening.integrations import screen_and_apply
from apps.screening.models import ModerationDecision, ScreeningLog, ScreeningRule


def make_user(email, role=User.Role.USER):
    user = User.objects.create_user(
        email=email,
        display_name=email.split("@")[0],
        password="SecurePass123!",
        member_type=User.MemberType.STUDENT,
        college="College of ICT",
        year_level=2,
    )
    user.role = role
    user.verify()
    return user


class ScrubTests(TestCase):
    """AI-09: nothing identifying reaches the provider."""

    def test_scrubs_email(self):
        self.assertNotIn("juan@rtu.edu.ph", services.scrub("Email me at juan@rtu.edu.ph"))

    def test_scrubs_mobile_numbers(self):
        for raw in ("09171234567", "+639171234567", "0917 123 4567", "0917-123-4567"):
            cleaned = services.scrub(f"Text me {raw} anytime")
            self.assertNotIn("0917", cleaned, raw)
            self.assertIn(services.REDACTED, cleaned)

    def test_scrubs_student_number(self):
        cleaned = services.scrub("I am 2024-123456 from BSIT")
        self.assertNotIn("2024-123456", cleaned)

    def test_scrubs_social_handles_and_links(self):
        cleaned = services.scrub("add me on FB: juan.dela.cruz and https://fb.com/juan")
        self.assertNotIn("juan.dela.cruz", cleaned)
        self.assertNotIn("https://fb.com", cleaned)

    def test_scrubs_introduced_names(self):
        cleaned = services.scrub("My name is Juan Dela Cruz, selling lumpia")
        self.assertNotIn("Juan Dela Cruz", cleaned)
        self.assertIn("selling lumpia", cleaned)

    def test_keeps_ordinary_text(self):
        text = "Homemade lumpia, ready at the main gate after 3pm."
        self.assertEqual(services.scrub(text), text)


class RuleScreenerTests(TestCase):
    """AI-02, AI-03, AI-05, AI-12, AI-14."""

    def test_clean_text_is_approved(self):
        verdict = services.screen("Selling used textbooks for accounting.")
        self.assertEqual(verdict.outcome, services.APPROVED)
        self.assertTrue(verdict.is_confident_enough)

    def test_prohibited_term_is_rejected_with_a_reason(self):
        verdict = services.screen("Selling a baril, slightly used.")
        self.assertEqual(verdict.outcome, services.REJECTED)
        self.assertIn("baril", verdict.reason)

    def test_review_term_needs_a_human(self):
        verdict = services.screen("Selling vape juice, strawberry flavour.")
        self.assertEqual(verdict.outcome, services.NEEDS_REVIEW)

    def test_taglish_and_filipino_are_screened(self):
        self.assertEqual(services.screen("Selling shabu").outcome, services.REJECTED)
        self.assertEqual(
            services.screen("Peke na ID ang binebenta ko").outcome, services.REJECTED
        )

    @override_settings(SCREENING_MIN_CONFIDENCE=0.95)
    def test_low_confidence_approval_becomes_needs_review(self):
        """AI-12: the stub approves at 0.8, so raising the bar must downgrade it."""
        verdict = services.screen("Selling used textbooks for accounting.")
        self.assertEqual(verdict.outcome, services.NEEDS_REVIEW)

    def test_unknown_outcome_is_rejected_by_the_dataclass(self):
        with self.assertRaises(ValueError):
            services.Verdict(outcome="maybe")


class ProviderFailureTests(TestCase):
    """AI-07: an unavailable provider never approves anything."""

    def test_exception_sends_the_item_to_review(self):
        class Broken(services.BaseScreener):
            name = "broken"

            def screen(self, text, *, kind="listing"):
                raise RuntimeError("provider down")

        original = services.get_screener
        services.get_screener = lambda: Broken()
        try:
            verdict = services.screen("Selling used textbooks.")
        finally:
            services.get_screener = original

        self.assertEqual(verdict.outcome, services.NEEDS_REVIEW)

    def test_unavailable_screener_never_approves(self):
        verdict = services.UnavailableScreener().screen("Anything at all")
        self.assertEqual(verdict.outcome, services.NEEDS_REVIEW)
        self.assertEqual(verdict.confidence, 0.0)


class RuleFromDatabaseTests(TestCase):
    """AI-10 and AI-11: an Administrator changes rules without a deploy."""

    def test_database_rule_overrides_the_defaults(self):
        ScreeningRule.objects.create(term="Bawal Item", outcome=services.REJECTED)

        verdict = services.screen("Selling bawal item here")

        self.assertEqual(verdict.outcome, services.REJECTED)

    def test_deactivated_rule_is_ignored(self):
        ScreeningRule.objects.create(term="bawal item", outcome=services.REJECTED, is_active=False)

        verdict = services.screen("Selling bawal item here")

        self.assertEqual(verdict.outcome, services.APPROVED)

    def test_terms_are_normalised_to_lowercase(self):
        rule = ScreeningRule.objects.create(term="  Shabu  ")
        self.assertEqual(rule.term, "shabu")


class ScreenAndApplyTests(TestCase):
    """AI-02 to AI-05: the verdict drives the listing status."""

    def setUp(self):
        self.seller = make_user("2024-111111@rtu.edu.ph")
        self.category = Category.objects.create(name="Snacks")

    def make_listing(self, title, description="Fresh from the kitchen."):
        return Listing.objects.create(
            seller=self.seller,
            category=self.category,
            title=title,
            description=description,
            price="50.00",
            quantity=2,
            meetup_place="Main gate",
        )

    def test_approved_listing_is_published(self):
        listing = self.make_listing("Fresh Lumpia")

        verdict, log = screen_and_apply(listing)

        listing.refresh_from_db()
        self.assertEqual(verdict.outcome, services.APPROVED)
        self.assertEqual(listing.status, Listing.Status.APPROVED)
        self.assertIsNotNone(listing.published_at)
        self.assertEqual(log.outcome, services.APPROVED)

    def test_rejected_listing_carries_the_reason(self):
        listing = self.make_listing("Baril for sale")

        screen_and_apply(listing)

        listing.refresh_from_db()
        self.assertEqual(listing.status, Listing.Status.REJECTED)
        self.assertIn("baril", listing.rejection_reason)
        self.assertIsNone(listing.published_at)

    def test_review_listing_is_held(self):
        listing = self.make_listing("Vape juice")

        screen_and_apply(listing)

        listing.refresh_from_db()
        self.assertEqual(listing.status, Listing.Status.NEEDS_REVIEW)
        self.assertIsNone(listing.published_at)

    def test_log_stores_the_scrubbed_text_only(self):
        """AI-08 and AI-09 together: the log holds what was actually sent."""
        listing = self.make_listing("Lumpia", "Text 09171234567 to order.")

        _, log = screen_and_apply(listing)

        self.assertNotIn("09171234567", log.cleaned_text)
        self.assertIn(services.REDACTED, log.cleaned_text)
        self.assertEqual(log.object_id, listing.pk)


class ModerationQueueApiTests(APITestCase):
    """AI-04 and AI-11: the queue, and a moderator overruling the AI."""

    def setUp(self):
        self.seller = make_user("2024-222222@rtu.edu.ph")
        self.moderator = make_user("mod@rtu.edu.ph", role=User.Role.MODERATOR)
        self.stranger = make_user("2024-333333@rtu.edu.ph")
        self.category = Category.objects.create(name="Snacks")

    def make_listing(self, title, status_value):
        return Listing.objects.create(
            seller=self.seller,
            category=self.category,
            title=title,
            description="d",
            price="10.00",
            quantity=1,
            meetup_place="gate",
            status=status_value,
        )

    def test_only_a_moderator_may_read_the_queue(self):
        self.assertEqual(
            self.client.get("/api/v1/moderation/queue/").status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
        self.client.force_authenticate(self.stranger)
        self.assertEqual(
            self.client.get("/api/v1/moderation/queue/").status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_queue_holds_review_and_rejected_items_only(self):
        self.make_listing("Waiting", Listing.Status.NEEDS_REVIEW)
        self.make_listing("Refused", Listing.Status.REJECTED)
        self.make_listing("Live", Listing.Status.APPROVED)
        self.make_listing("Draft", Listing.Status.DRAFT)

        self.client.force_authenticate(self.moderator)
        response = self.client.get("/api/v1/moderation/queue/")

        titles = {row["title"] for row in response.json()["results"]}
        self.assertEqual(titles, {"Waiting", "Refused"})

    def test_queue_can_be_narrowed_by_status(self):
        self.make_listing("Waiting", Listing.Status.NEEDS_REVIEW)
        self.make_listing("Refused", Listing.Status.REJECTED)

        self.client.force_authenticate(self.moderator)
        response = self.client.get("/api/v1/moderation/queue/?status=rejected")

        self.assertEqual([r["title"] for r in response.json()["results"]], ["Refused"])

    def test_moderator_reverses_a_rejection_and_it_is_published(self):
        listing = self.make_listing("Refused", Listing.Status.REJECTED)
        ScreeningLog.objects.create(
            content_type=ScreeningLog.ContentType.LISTING,
            object_id=listing.pk,
            cleaned_text="x",
            outcome=services.REJECTED,
            confidence=0.9,
        )

        self.client.force_authenticate(self.moderator)
        response = self.client.post(
            f"/api/v1/moderation/queue/{listing.slug}/decide/",
            {"decision": "approve", "note": "Not a weapon, it is a toy."},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        listing.refresh_from_db()
        self.assertEqual(listing.status, Listing.Status.APPROVED)
        self.assertIsNotNone(listing.published_at)

        decision = ModerationDecision.objects.get()
        self.assertEqual(decision.decision, ModerationDecision.Decision.REVERSED)
        self.assertFalse(decision.agreed_with_ai)

    def test_rejecting_requires_a_note(self):
        listing = self.make_listing("Waiting", Listing.Status.NEEDS_REVIEW)

        self.client.force_authenticate(self.moderator)
        response = self.client.post(
            f"/api/v1/moderation/queue/{listing.slug}/decide/",
            {"decision": "reject"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_a_plain_member_cannot_decide(self):
        listing = self.make_listing("Waiting", Listing.Status.NEEDS_REVIEW)

        self.client.force_authenticate(self.stranger)
        response = self.client.post(
            f"/api/v1/moderation/queue/{listing.slug}/decide/",
            {"decision": "approve"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_screening_log_is_moderator_only(self):
        self.client.force_authenticate(self.stranger)
        self.assertEqual(
            self.client.get("/api/v1/moderation/screening-log/").status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_disagreement_filter_lists_only_overruled_rows(self):
        """AI-15: the rows worth measuring."""
        agreed_listing = self.make_listing("A", Listing.Status.NEEDS_REVIEW)
        overruled = self.make_listing("B", Listing.Status.NEEDS_REVIEW)
        ScreeningLog.objects.create(
            content_type=ScreeningLog.ContentType.LISTING,
            object_id=agreed_listing.pk,
            cleaned_text="a",
            outcome=services.NEEDS_REVIEW,
        )
        log_b = ScreeningLog.objects.create(
            content_type=ScreeningLog.ContentType.LISTING,
            object_id=overruled.pk,
            cleaned_text="b",
            outcome=services.NEEDS_REVIEW,
        )
        ModerationDecision.objects.create(
            log=log_b,
            moderator=self.moderator,
            decision=ModerationDecision.Decision.REVERSED,
            final_outcome=services.APPROVED,
        )

        self.client.force_authenticate(self.moderator)
        response = self.client.get("/api/v1/moderation/screening-log/?disagreed=1")

        self.assertEqual([r["id"] for r in response.json()["results"]], [log_b.id])


class CreateListingIsScreenedTests(APITestCase):
    """AI-01: posting a listing screens it, instead of parking it forever."""

    def setUp(self):
        self.seller = make_user("2024-444444@rtu.edu.ph")
        self.category = Category.objects.create(name="Snacks")

    def payload(self, title, description="Fresh."):
        return {
            "category": self.category.pk,
            "title": title,
            "description": description,
            "listing_type": "product",
            "condition": "new",
            "price": "15.00",
            "quantity": 1,
            "meetup_place": "Library",
        }

    def test_clean_listing_is_published_immediately(self):
        self.client.force_authenticate(self.seller)
        response = self.client.post("/api/v1/listings/", self.payload("Lumpia"), format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()["status"], Listing.Status.APPROVED)

        anonymous = self.client.get("/api/v1/listings/")
        self.client.force_authenticate(None)
        anonymous = self.client.get("/api/v1/listings/")
        self.assertEqual(len(anonymous.json()["results"]), 1)

    def test_prohibited_listing_is_rejected_with_a_reason(self):
        self.client.force_authenticate(self.seller)
        response = self.client.post(
            "/api/v1/listings/", self.payload("Baril"), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()["status"], Listing.Status.REJECTED)
        self.assertTrue(response.json()["rejection_reason"])

    def test_a_screening_log_row_is_written(self):
        self.client.force_authenticate(self.seller)
        self.client.post("/api/v1/listings/", self.payload("Lumpia"), format="json")

        self.assertEqual(ScreeningLog.objects.count(), 1)
