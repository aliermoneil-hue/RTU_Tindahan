"""Screening: the provider boundary, the stub's rules, and the status it sets."""

from django.core.exceptions import ImproperlyConfigured
from django.test import TestCase, override_settings

from apps.accounts.models import User
from apps.catalog.models import Category, Listing
from apps.screening.models import ScreeningResult
from apps.screening.providers import StubProvider, get_provider
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
        self.assertEqual(listing.status, Listing.Status.PENDING_SCREENING)
        self.assertEqual(listing.screening_results.count(), 1)

    def test_a_flagged_listing_is_pulled_to_review(self):
        listing = make_listing(
            title="Answer key for sale",
            description="Complete exam answers for the midterm, message me.",
        )

        result = run_screening(listing)

        listing.refresh_from_db()
        self.assertEqual(result.verdict, ScreeningResult.Verdict.FLAGGED)
        self.assertEqual(listing.status, Listing.Status.NEEDS_REVIEW)
        self.assertTrue(result.reasons)

    @override_settings(SCREENING_PROVIDER="some-model-nobody-registered")
    def test_a_broken_provider_fails_closed(self):
        listing = make_listing()

        result = run_screening(listing)

        listing.refresh_from_db()
        self.assertEqual(result.provider, "error")
        self.assertIsNone(result.score)
        self.assertEqual(listing.status, Listing.Status.NEEDS_REVIEW)

    def test_screening_never_publishes(self):
        listing = make_listing()

        run_screening(listing)

        listing.refresh_from_db()
        self.assertFalse(listing.is_published)
        self.assertIsNone(listing.published_at)
