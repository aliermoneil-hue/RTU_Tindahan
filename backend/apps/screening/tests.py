"""Screening: the provider boundary, the stub's rules, and the status it sets."""

import json
from unittest.mock import patch

from django.core.exceptions import ImproperlyConfigured
from django.test import TestCase, override_settings

from apps.accounts.models import User
from apps.catalog.models import Category, Listing
from apps.screening.models import ScreeningResult
from apps.screening.providers import GeminiProvider, StubProvider, get_provider
from apps.screening.services import run_screening


def make_listing(**overrides):
    seller = User.objects.create_user(
        email="2024-123456@rtu.edu.ph",
        display_name="Seller",
        password="SecurePass123!",
        member_type=User.MemberType.STUDENT,
        college="College of ICT",
        year_level=2,
    )
    seller.verify()
    data = {
        "seller": seller,
        "category": Category.objects.create(name="Misc"),
        "title": "Second-hand calculator",
        "description": "Casio fx-991, working, complete with case.",
        "listing_type": Listing.Type.PRODUCT,
        "condition": Listing.Condition.USED,
        "price": "800.00",
        "quantity": 1,
        "meetup_place": "Main gate",
    }
    data.update(overrides)
    return Listing.objects.create(**data)


class StubProviderTests(TestCase):
    def test_a_plain_listing_is_clean(self):
        verdict = StubProvider().screen(make_listing())

        self.assertEqual(verdict.verdict, "clean")
        self.assertEqual(verdict.reasons, [])

    def test_a_prohibited_item_is_flagged_with_a_reason(self):
        listing = make_listing(
            title="Counterfeit RTU uniform",
            description="Exact copy of the official uniform, no one will notice.",
        )

        verdict = StubProvider().screen(listing)

        self.assertEqual(verdict.verdict, "flagged")
        self.assertGreaterEqual(verdict.score, 50)
        self.assertTrue(any("prohibited item" in reason for reason in verdict.reasons))

    def test_a_link_in_the_text_is_flagged(self):
        listing = make_listing(
            description="Buy from my shop at www.notallowed.example for more items."
        )

        verdict = StubProvider().screen(listing)

        self.assertEqual(verdict.verdict, "flagged")

    def test_vapes_are_flagged_even_though_they_are_not_a_scam(self):
        listing = make_listing(
            title="Vape starter kit",
            description="Barely used vape with charger and two pods.",
        )

        verdict = StubProvider().screen(listing)

        self.assertEqual(verdict.verdict, "flagged")
        self.assertTrue(any("prohibited item" in reason for reason in verdict.reasons))

    def test_a_pay_first_off_app_pattern_is_flagged(self):
        listing = make_listing(
            description="Pay first via GCash number 09171234567, no meetup needed.",
        )

        verdict = StubProvider().screen(listing)

        self.assertEqual(verdict.verdict, "flagged")
        self.assertGreaterEqual(verdict.score, 50)
        self.assertTrue(any("off-app" in reason for reason in verdict.reasons))

    def test_a_short_description_is_flagged(self):
        listing = make_listing(description="Calculator.")

        verdict = StubProvider().screen(listing)

        self.assertEqual(verdict.verdict, "flagged")
        self.assertTrue(any("too short" in reason for reason in verdict.reasons))

    def test_a_price_above_fifty_thousand_is_flagged(self):
        listing = make_listing(
            description="Well kept laptop, complete with charger and bag.",
            price="50001.00",
        )

        verdict = StubProvider().screen(listing)

        self.assertEqual(verdict.verdict, "flagged")

    def test_fifty_thousand_exactly_is_not_flagged_for_price(self):
        listing = make_listing(
            description="Well kept laptop, complete with charger and bag.",
            price="50000.00",
        )

        verdict = StubProvider().screen(listing)

        self.assertEqual(verdict.verdict, "clean")

    def test_an_all_caps_title_alone_stays_below_the_threshold(self):
        listing = make_listing(
            title="SECOND HAND SCIENTIFIC CALCULATOR",
            description="Casio fx-991, working, complete with case.",
        )

        verdict = StubProvider().screen(listing)

        self.assertEqual(verdict.verdict, "clean")
        self.assertLess(verdict.score, 50)
        self.assertTrue(any("all capitals" in reason for reason in verdict.reasons))

    def test_a_word_inside_another_word_is_not_a_hit(self):
        listing = make_listing(
            title="Twine ball",
            description="One roll of cotton twine, unused, from a crafts class.",
        )

        verdict = StubProvider().screen(listing)

        # "wine" must not fire inside "twine".
        self.assertEqual(verdict.verdict, "clean")

    def test_the_stub_is_deterministic(self):
        listing = make_listing()

        first = StubProvider().screen(listing)
        second = StubProvider().screen(listing)

        self.assertEqual(first.verdict, second.verdict)
        self.assertEqual(first.score, second.score)
        self.assertEqual(first.reasons, second.reasons)

    @override_settings(SCREENING_PROVIDER="some-model-nobody-registered")
    def test_an_unregistered_provider_is_a_configuration_error(self):
        with self.assertRaises(ImproperlyConfigured):
            get_provider()


@override_settings(SCREENING_PROVIDER="stub")
class RunScreeningTests(TestCase):
    def test_a_clean_listing_keeps_waiting_for_a_moderator(self):
        listing = make_listing()

        result = run_screening(listing)

        listing.refresh_from_db()
        self.assertEqual(result.verdict, ScreeningResult.Verdict.CLEAN)
        self.assertEqual(listing.moderation_status, Listing.ModerationStatus.PENDING_SCREENING)
        self.assertEqual(listing.screening_results.count(), 1)

    def test_a_flagged_listing_is_pulled_to_review(self):
        listing = make_listing(
            title="Answer key for sale",
            description="Complete exam answers for the midterm, message me.",
        )

        result = run_screening(listing)

        listing.refresh_from_db()
        self.assertEqual(result.verdict, ScreeningResult.Verdict.FLAGGED)
        self.assertEqual(listing.moderation_status, Listing.ModerationStatus.NEEDS_REVIEW)
        self.assertTrue(result.reasons)

    @override_settings(SCREENING_PROVIDER="some-model-nobody-registered")
    def test_a_misnamed_provider_falls_back_to_the_rules(self):
        listing = make_listing()

        result = run_screening(listing)

        listing.refresh_from_db()
        self.assertEqual(result.provider, "some-model-nobody-registered+fallback")
        self.assertEqual(result.verdict, ScreeningResult.Verdict.CLEAN)
        self.assertEqual(listing.moderation_status, Listing.ModerationStatus.PENDING_SCREENING)

    @override_settings(
        SCREENING_PROVIDER="some-model-nobody-registered", SCREENING_FALLBACK=False
    )
    def test_a_misnamed_provider_fails_closed_when_the_fallback_is_off(self):
        listing = make_listing()

        result = run_screening(listing)

        listing.refresh_from_db()
        self.assertEqual(result.provider, "error")
        self.assertIsNone(result.score)
        self.assertEqual(listing.moderation_status, Listing.ModerationStatus.NEEDS_REVIEW)

    def test_screening_never_publishes(self):
        listing = make_listing()

        run_screening(listing)

        listing.refresh_from_db()
        self.assertFalse(listing.is_published)
        self.assertIsNone(listing.published_at)


def gemini_reply(verdict="clean", score=0, reasons=None, finish="STOP"):
    """The shape Gemini returns, with a schema-constrained JSON answer inside."""
    inner = json.dumps(
        {"verdict": verdict, "score": score, "reasons": reasons or []}
    )
    return {
        "candidates": [
            {"content": {"parts": [{"text": inner}]}, "finishReason": finish}
        ],
        "usageMetadata": {"totalTokenCount": 120},
    }


class GeminiProviderTests(TestCase):
    def test_a_clean_answer_is_read_back(self):
        provider = GeminiProvider(
            api_key="k",
            transport=lambda *args: gemini_reply("clean", 0, []),
        )

        verdict = provider.screen(make_listing())

        self.assertEqual(verdict.verdict, "clean")
        self.assertEqual(verdict.provider, "gemini")
        self.assertEqual(verdict.raw["tokens"], 120)

    def test_a_flagged_answer_keeps_its_reasons(self):
        provider = GeminiProvider(
            api_key="k",
            transport=lambda *args: gemini_reply(
                "flagged", 95, ["Sale of exam answers is prohibited."]
            ),
        )

        verdict = provider.screen(make_listing())

        self.assertEqual(verdict.verdict, "flagged")
        self.assertEqual(verdict.reasons, ["Sale of exam answers is prohibited."])

    def test_an_unreadable_verdict_is_treated_as_flagged(self):
        provider = GeminiProvider(
            api_key="k",
            transport=lambda *args: gemini_reply("probably fine", 10, []),
        )

        verdict = provider.screen(make_listing())

        self.assertEqual(verdict.verdict, "flagged")

    def test_the_key_travels_in_a_header_not_the_url(self):
        seen = {}

        def transport(url, payload, headers, timeout):
            seen.update(url=url, headers=headers, timeout=timeout)
            return gemini_reply()

        provider = GeminiProvider(api_key="secret-key", model="gemini-test", transport=transport)
        provider.screen(make_listing())

        self.assertNotIn("secret-key", seen["url"])
        self.assertEqual(seen["headers"]["x-goog-api-key"], "secret-key")
        self.assertIn("gemini-test", seen["url"])

    def test_a_missing_key_refuses_to_construct(self):
        with self.assertRaises(ImproperlyConfigured):
            GeminiProvider(api_key="")


@override_settings(
    SCREENING_PROVIDER="gemini",
    SCREENING_API_KEY="test-key",
    SCREENING_FALLBACK=True,
)
class GeminiFallbackTests(TestCase):
    def test_a_failing_provider_falls_back_to_the_rules(self):
        listing = make_listing()

        with patch(
            "apps.screening.providers.post_json", side_effect=TimeoutError("slow")
        ):
            result = run_screening(listing)

        listing.refresh_from_db()
        self.assertEqual(result.provider, "gemini+fallback")
        self.assertEqual(result.verdict, ScreeningResult.Verdict.CLEAN)
        self.assertTrue(any("rules check" in reason for reason in result.reasons))
        self.assertEqual(listing.moderation_status, Listing.ModerationStatus.PENDING_SCREENING)

    @override_settings(SCREENING_FALLBACK=False)
    def test_with_the_fallback_off_a_failure_goes_to_a_moderator(self):
        listing = make_listing()

        with patch(
            "apps.screening.providers.post_json", side_effect=TimeoutError("slow")
        ):
            result = run_screening(listing)

        listing.refresh_from_db()
        self.assertEqual(result.provider, "error")
        self.assertEqual(listing.moderation_status, Listing.ModerationStatus.NEEDS_REVIEW)

    def test_a_live_provider_answers_are_used_when_it_works(self):
        listing = make_listing()

        with patch(
            "apps.screening.providers.post_json",
            return_value=gemini_reply("flagged", 88, ["Prohibited item."]),
        ):
            result = run_screening(listing)

        listing.refresh_from_db()
        self.assertEqual(result.provider, "gemini")
        self.assertEqual(result.score, 88)
        self.assertEqual(listing.moderation_status, Listing.ModerationStatus.NEEDS_REVIEW)
