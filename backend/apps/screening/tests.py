"""Screening: the provider boundary, the stub's rules, and the status it sets."""

import json
from unittest.mock import patch

from decimal import Decimal

from django.core.exceptions import ImproperlyConfigured
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.audit.models import AuditLog
from apps.catalog.models import Category, Listing
from apps.screening.models import ScreeningResult, ScreeningRule
from apps.screening.providers import (
    GeminiProvider,
    StubProvider,
    TextSubject,
    get_provider,
)
from apps.screening.services import run_screening


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

    def test_a_prohibited_item_is_rejected_with_a_reason(self):
        listing = make_listing(
            title="Counterfeit RTU uniform",
            description="Exact copy of the official uniform, no one will notice.",
        )

        verdict = StubProvider().screen(listing)

        # AI-11: a named violation is rejected, not merely held — and rejected
        # still means queued, because the AI is never the final authority.
        self.assertEqual(verdict.verdict, "rejected")
        self.assertGreaterEqual(verdict.score, 90)
        self.assertGreaterEqual(verdict.confidence, 0.9)
        self.assertTrue(any("prohibited item" in reason for reason in verdict.reasons))

    def test_a_link_in_the_text_is_flagged(self):
        listing = make_listing(
            description="Buy from my shop at www.notallowed.example for more items."
        )

        verdict = StubProvider().screen(listing)

        self.assertEqual(verdict.verdict, "flagged")

    def test_vapes_are_rejected_even_though_they_are_not_a_scam(self):
        listing = make_listing(
            title="Vape starter kit",
            description="Barely used vape with charger and two pods.",
        )

        verdict = StubProvider().screen(listing)

        self.assertEqual(verdict.verdict, "rejected")
        self.assertTrue(any("prohibited item" in reason for reason in verdict.reasons))

    def test_a_pay_first_off_app_pattern_is_flagged(self):
        listing = make_listing(
            description="Pay first via GCash number 09171234567, no meetup needed.",
        )

        verdict = StubProvider().screen(listing)

        self.assertEqual(verdict.verdict, "flagged")
        self.assertGreaterEqual(verdict.score, 50)
        self.assertTrue(any("off-app" in reason for reason in verdict.reasons))

    def test_a_short_description_is_flagged_and_carries_a_low_confidence(self):
        listing = make_listing(description="Calculator.")

        verdict = StubProvider().screen(listing)

        self.assertEqual(verdict.verdict, "flagged")
        self.assertTrue(any("too short" in reason for reason in verdict.reasons))
        # AI-12: a judgement call, not a rule hit, and the number says so.
        self.assertLess(verdict.confidence, 0.7)

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

    def test_root_beer_does_not_flag_as_alcohol(self):
        listing = make_listing(
            title="Root beer float",
            description="Root beer float, served cold at the food stall.",
        )

        verdict = StubProvider().screen(listing)

        self.assertEqual(verdict.verdict, "clean")

    def test_a_book_title_does_not_flag_as_stolen_goods(self):
        listing = make_listing(
            title="The Stolen Heir",
            description="Paperback novel, The Stolen Heir, good condition, no markings.",
        )

        verdict = StubProvider().screen(listing)

        self.assertEqual(verdict.verdict, "clean")

    def test_stolen_goods_are_rejected(self):
        listing = make_listing(
            title="Stolen goods",
            description="Brand new phone, still boxed, no questions asked, meet at the gate.",
        )

        verdict = StubProvider().screen(listing)

        self.assertEqual(verdict.verdict, "rejected")
        self.assertTrue(any("prohibited item" in reason for reason in verdict.reasons))

    def test_liquor_is_rejected(self):
        listing = make_listing(
            title="Liquor for sale",
            description="Unopened bottle, picked up at the main gate after class.",
        )

        verdict = StubProvider().screen(listing)

        self.assertEqual(verdict.verdict, "rejected")

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

    def test_a_prohibited_listing_is_rejected_and_left_in_the_queue(self):
        listing = make_listing(
            title="Answer key for sale",
            description="Complete exam answers for the midterm, message me.",
        )

        result = run_screening(listing)

        listing.refresh_from_db()
        self.assertEqual(result.verdict, ScreeningResult.Verdict.REJECTED)
        self.assertEqual(listing.moderation_status, Listing.ModerationStatus.REJECTED)
        self.assertTrue(result.reasons)
        # Still waiting on a person: the rejection is a claim, not a sentence.
        self.assertEqual(result.decision, ScreeningResult.Decision.PENDING)
        self.assertFalse(listing.is_published)

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


def gemini_reply(verdict="clean", score=0, reasons=None, finish="STOP", confidence=0.95):
    """The shape Gemini returns, with a schema-constrained JSON answer inside."""
    answer = {"verdict": verdict, "score": score, "reasons": reasons or []}
    if confidence is not None:
        answer["confidence"] = confidence
    inner = json.dumps(answer)
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


def make_post(author=None, **overrides):
    from apps.forum.models import ForumPost

    author = author or User.objects.create_user(
        email="2024-654321@rtu.edu.ph",
        display_name="Poster",
        password="SecurePass123!",
        member_type=User.MemberType.STUDENT,
        college="College of ICT",
        year_level=2,
    )
    author.verify()
    data = {
        "kind": ForumPost.Kind.POST,
        "topic": "General",
        "title": "Study group for ITP311",
        "body": "We meet at the library every Friday after class. Anyone is welcome.",
        "author": author,
    }
    data.update(overrides)
    return ForumPost.objects.create(**data)


@override_settings(SCREENING_PROVIDER="stub", SCREENING_FALLBACK=True)
class ForumPostScreeningTests(TestCase):
    """AI-03 on the forum: a flagged post is held, never silently published."""

    def setUp(self):
        self.author = User.objects.create_user(
            email="2024-777777@rtu.edu.ph",
            display_name="Poster",
            password="SecurePass123!",
            member_type=User.MemberType.STUDENT,
            college="College of ICT",
            year_level=2,
        )
        self.author.verify()
        self.moderator = User.objects.create_user(
            email="2024-888888@rtu.edu.ph",
            display_name="Moderator",
            password="SecurePass123!",
            role=User.Role.MODERATOR,
        )
        self.moderator.verify()

    def test_a_prohibited_post_is_held_with_its_reasons(self):
        from apps.forum.models import ForumPost
        from apps.notifications.models import Notification
        from apps.screening.services import run_post_screening

        post = make_post(
            author=self.author,
            title="Selling answer keys",
            body="Complete exam answers for the midterm, cheap. Message me.",
        )

        result = run_post_screening(post)

        post.refresh_from_db()
        self.assertEqual(result.verdict, "rejected")
        self.assertEqual(result.post_id, post.pk)
        self.assertIsNone(result.listing_id)
        self.assertTrue(any("prohibited item" in r for r in result.reasons))
        self.assertEqual(post.moderation_status, ForumPost.ModerationStatus.NEEDS_REVIEW)
        # The author is told, and the moderator queue hears about it.
        self.assertTrue(
            Notification.objects.filter(
                user=self.author, kind=Notification.Kind.SYSTEM, link_id=str(post.pk)
            ).exists()
        )
        self.assertTrue(
            Notification.objects.filter(
                user=self.moderator, link_kind="freports", link_id=str(post.pk)
            ).exists()
        )

    def test_an_ordinary_post_stays_visible(self):
        from apps.forum.models import ForumPost
        from apps.screening.services import run_post_screening

        post = make_post(author=self.author)

        result = run_post_screening(post)

        post.refresh_from_db()
        self.assertEqual(result.verdict, "clean")
        self.assertEqual(result.reasons, [])
        self.assertEqual(post.moderation_status, ForumPost.ModerationStatus.VISIBLE)

    def test_a_post_is_not_judged_by_listing_signals(self):
        """Links, phone numbers and one-line replies are ordinary in a thread."""
        from apps.screening.services import run_post_screening

        post = make_post(
            author=self.author,
            title="Reviewer link",
            body="Here is the reviewer everyone asked for: https://example.test/notes "
            "DM me at 09171234567 if the link dies.",
        )

        result = run_post_screening(post)

        self.assertEqual(result.verdict, "clean")
        self.assertEqual(result.score, 0)

    def test_two_runs_agree_and_only_the_first_holds(self):
        from apps.screening.services import run_post_screening

        post = make_post(
            author=self.author,
            title="Cheap vape",
            body="Selling my vape, barely used, meet at the gate.",
        )

        first = run_post_screening(post)
        second = run_post_screening(post)

        self.assertEqual(first.verdict, second.verdict)
        self.assertEqual(ScreeningResult.objects.filter(post=post).count(), 2)

    def test_a_clean_re_screen_does_not_release_a_held_post(self):
        from apps.forum.models import ForumPost
        from apps.screening.services import run_post_screening

        post = make_post(
            author=self.author,
            title="Cheap vape",
            body="Selling my vape, barely used, meet at the gate.",
        )
        run_post_screening(post)
        post.refresh_from_db()
        self.assertEqual(post.moderation_status, ForumPost.ModerationStatus.NEEDS_REVIEW)

        post.body = "Selling my old calculator instead."
        post.save(update_fields=["body"])
        run_post_screening(post)

        post.refresh_from_db()
        self.assertEqual(post.moderation_status, ForumPost.ModerationStatus.NEEDS_REVIEW)

    @override_settings(
        SCREENING_PROVIDER="gemini", SCREENING_API_KEY="***", SCREENING_FALLBACK=False
    )
    def test_a_dead_provider_holds_the_post_when_the_fallback_is_off(self):
        from apps.forum.models import ForumPost
        from apps.screening.services import run_post_screening

        post = make_post(author=self.author)

        with patch(
            "apps.screening.providers.post_json", side_effect=TimeoutError("slow")
        ):
            result = run_post_screening(post)

        post.refresh_from_db()
        self.assertEqual(result.provider, "error")
        self.assertEqual(result.verdict, "flagged")
        self.assertEqual(post.moderation_status, ForumPost.ModerationStatus.NEEDS_REVIEW)

    def test_a_result_row_names_exactly_one_target(self):
        from django.db import IntegrityError, transaction

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                ScreeningResult.objects.create(
                    verdict=ScreeningResult.Verdict.CLEAN, provider="stub"
                )


@override_settings(SCREENING_PROVIDER="stub", SCREENING_FALLBACK=True)
class ForumCommentScreeningTests(TestCase):
    """AI-03 one level down: a comment publishes inside someone's thread."""

    def setUp(self):
        from apps.forum.models import ForumPost

        self.author = User.objects.create_user(
            email="2024-555555@rtu.edu.ph",
            display_name="Commenter",
            password="SecurePass123!",
            member_type=User.MemberType.STUDENT,
            college="College of ICT",
            year_level=2,
        )
        self.author.verify()
        self.post = ForumPost.objects.create(
            kind=ForumPost.Kind.POST,
            topic="General",
            title="Reviewer for ITP311",
            body="Sharing my notes, comment if you want a copy.",
            author=self.author,
        )

    def comment(self, text):
        from apps.forum.models import ForumComment

        return ForumComment.objects.create(
            post=self.post, author=self.author, text=text
        )

    def test_a_prohibited_comment_is_held(self):
        from apps.forum.models import ForumComment
        from apps.notifications.models import Notification
        from apps.screening.services import run_comment_screening

        row = self.comment("Selling answer keys, 300 pesos, message me.")

        result = run_comment_screening(row)

        row.refresh_from_db()
        self.assertEqual(result.verdict, "rejected")
        self.assertEqual(result.comment_id, row.pk)
        self.assertEqual(row.moderation_status, ForumComment.ModerationStatus.NEEDS_REVIEW)
        self.assertTrue(
            Notification.objects.filter(
                user=self.author, link_kind="post", link_id=str(self.post.pk)
            ).exists()
        )

    def test_an_ordinary_comment_stays_visible(self):
        from apps.forum.models import ForumComment
        from apps.screening.services import run_comment_screening

        row = self.comment("Interested! Where do we meet?")

        result = run_comment_screening(row)

        row.refresh_from_db()
        self.assertEqual(result.verdict, "clean")
        self.assertEqual(row.moderation_status, ForumComment.ModerationStatus.VISIBLE)

    def test_a_comment_is_judged_by_prohibited_content_only(self):
        from apps.screening.services import run_comment_screening

        row = self.comment("See the thread here https://example.test/x — DM me at 09171234567")

        result = run_comment_screening(row)

        self.assertEqual(result.verdict, "clean")

    @override_settings(
        SCREENING_PROVIDER="gemini", SCREENING_API_KEY="***", SCREENING_FALLBACK=False
    )
    def test_a_dead_provider_holds_the_comment(self):
        from apps.forum.models import ForumComment
        from apps.screening.services import run_comment_screening

        row = self.comment("Anything at all")

        with patch(
            "apps.screening.providers.post_json", side_effect=TimeoutError("slow")
        ):
            result = run_comment_screening(row)

        row.refresh_from_db()
        self.assertEqual(result.provider, "error")
        self.assertEqual(row.moderation_status, ForumComment.ModerationStatus.NEEDS_REVIEW)


class ScreeningRuleTableTests(APITestCase):
    """AI-10: the rules live in a table an administrator can change."""

    def setUp(self):
        self.admin = make_user("2024-666001@rtu.edu.ph", role=User.Role.ADMINISTRATOR)
        self.member = make_user("2024-666002@rtu.edu.ph")
        self.moderator = make_user("2024-666003@rtu.edu.ph", role=User.Role.MODERATOR)

    def listing(self, title, description="A perfectly ordinary item, described at length."):
        return Listing.objects.create(
            seller=self.member,
            category=Category.objects.first() or Category.objects.create(name="Misc"),
            title=title,
            description=description,
            listing_type=Listing.Type.PRODUCT,
            condition=Listing.Condition.USED,
            price=Decimal("100.00"),
            quantity=1,
            meetup_place="Main lobby",
        )

    def test_the_table_starts_from_the_code_list(self):
        from apps.screening.providers import PROHIBITED_TERMS, SCAM_PATTERNS

        self.assertGreaterEqual(ScreeningRule.objects.count(), len(PROHIBITED_TERMS))
        for phrase in PROHIBITED_TERMS[:5]:
            self.assertTrue(
                ScreeningRule.objects.filter(phrase=phrase, kind="prohibited").exists(),
                phrase,
            )
        for phrase in SCAM_PATTERNS[:3]:
            self.assertTrue(
                ScreeningRule.objects.filter(phrase=phrase, kind="scam").exists(), phrase
            )

    def test_a_new_phrase_flags_on_the_next_listing(self):
        clean = self.listing("Campus cap")
        verdict = StubProvider().screen(clean)
        self.assertEqual(verdict.verdict, "clean")

        self.client.force_authenticate(self.admin)
        created = self.client.post(
            "/api/v1/screening-rules/",
            {"phrase": "campus cap", "kind": "prohibited", "note": "Trial rule."},
            format="json",
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED, created.json())

        verdict = StubProvider().screen(clean)
        self.assertEqual(verdict.verdict, "rejected")
        self.assertIn("campus cap", " ".join(verdict.reasons))

    def test_switching_a_phrase_off_stops_it_flagging(self):
        rule, _ = ScreeningRule.objects.get_or_create(
            phrase="lab gown", defaults={"kind": "prohibited"}
        )
        rule.is_active = True
        rule.save(update_fields=["is_active"])
        item = self.listing("Lab gown, size M")
        self.assertEqual(StubProvider().screen(item).verdict, "rejected")

        self.client.force_authenticate(self.admin)
        patched = self.client.patch(
            f"/api/v1/screening-rules/{rule.pk}/", {"is_active": False}, format="json"
        )
        self.assertEqual(patched.status_code, status.HTTP_200_OK, patched.json())

        self.assertEqual(StubProvider().screen(item).verdict, "clean")

    def test_an_edit_reaches_the_language_model_on_the_next_call(self):
        ScreeningRule.objects.get_or_create(
            phrase="unofficial transcript", defaults={"kind": "prohibited"}
        )
        provider = GeminiProvider(api_key="test-key", transport=lambda *a, **k: {})
        payload = provider._payload(
            TextSubject(kind="listing", title="Transcript", description="Official copy.", price="10")
        )
        instruction = payload["systemInstruction"]["parts"][0]["text"]
        self.assertIn("unofficial transcript", instruction)

    def test_a_member_cannot_read_or_change_the_rules(self):
        self.client.force_authenticate(self.member)
        self.assertEqual(self.client.get("/api/v1/screening-rules/").status_code, 403)

        refused = self.client.post(
            "/api/v1/screening-rules/", {"phrase": "anything", "kind": "prohibited"}, format="json"
        )
        self.assertEqual(refused.status_code, 403)

    def test_a_moderator_may_read_but_not_write(self):
        self.client.force_authenticate(self.moderator)
        self.assertEqual(self.client.get("/api/v1/screening-rules/").status_code, 200)

        refused = self.client.post(
            "/api/v1/screening-rules/", {"phrase": "anything", "kind": "prohibited"}, format="json"
        )
        self.assertEqual(refused.status_code, 403)

    def test_every_change_is_audited(self):
        self.client.force_authenticate(self.admin)
        created = self.client.post(
            "/api/v1/screening-rules/", {"phrase": "exam leak", "kind": "prohibited"}, format="json"
        )
        rule_id = created.json()["id"]
        self.client.delete(f"/api/v1/screening-rules/{rule_id}/")

        actions = list(
            AuditLog.objects.filter(target_type="screening_rule").values_list("action", flat=True)
        )
        self.assertIn("screening rule added", actions)
        self.assertIn("screening rule removed", actions)

    def test_the_whole_list_comes_back_in_one_page(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get("/api/v1/screening-rules/?kind=prohibited")

        body = response.json()
        rows = body["results"] if isinstance(body, dict) and "results" in body else body
        self.assertEqual(len(rows), ScreeningRule.objects.filter(kind="prohibited").count())
        self.assertGreater(len(rows), 20)

    def test_a_duplicate_phrase_is_refused(self):
        ScreeningRule.objects.get_or_create(phrase="answer key", defaults={"kind": "prohibited"})
        self.client.force_authenticate(self.admin)

        refused = self.client.post(
            "/api/v1/screening-rules/", {"phrase": "answer key", "kind": "prohibited"}, format="json"
        )

        self.assertEqual(refused.status_code, status.HTTP_400_BAD_REQUEST)

    def test_an_empty_table_falls_back_to_the_code_list(self):
        ScreeningRule.objects.all().delete()
        from apps.screening import rules

        rules.invalidate()

        self.assertIn("answer key", rules.phrases("prohibited"))
        item = self.listing("Answer key for sale")
        self.assertEqual(StubProvider().screen(item).verdict, "rejected")


class TaglishScreeningTests(TestCase):
    """AI-14: the same offers, in the language students actually type."""

    def subject(self, title, description, price="200"):
        return TextSubject(kind="listing", title=title, description=description, price=price)

    def test_a_taglish_answer_key_offer_is_flagged(self):
        verdict = StubProvider().screen(
            self.subject("Answer key, complete", "May answer key ako sa exam, lahat ng subject.")
        )

        self.assertEqual(verdict.verdict, "rejected")
        self.assertGreaterEqual(verdict.score, 90)
        self.assertIn("may answer key ako", " ".join(verdict.reasons))

    def test_a_taglish_offer_to_take_an_exam_is_flagged(self):
        verdict = StubProvider().screen(
            self.subject("Tutor for finals", "Sagot ko exam mo, guaranteed pasado.")
        )

        self.assertEqual(verdict.verdict, "rejected")
        self.assertIn("sagot ko exam mo", " ".join(verdict.reasons))

    def test_a_taglish_pay_first_pattern_is_flagged_as_a_scam(self):
        verdict = StubProvider().screen(
            self.subject("Second-hand phone", "Bayad muna bago tayo magkita sa campus.")
        )

        self.assertEqual(verdict.verdict, "flagged")
        self.assertEqual(verdict.score, 85)
        self.assertIn("bayad muna", " ".join(verdict.reasons))

    def test_ordinary_taglish_is_left_alone(self):
        verdict = StubProvider().screen(
            self.subject(
                "Calculator, complete",
                "Maganda pa ang calculator, may case at manual. Meetup sa main lobby, bayad pag meetup.",
            )
        )

        self.assertEqual(verdict.verdict, "clean")
        self.assertEqual(verdict.reasons, [])

    def test_the_taglish_phrases_are_in_the_table(self):
        for phrase in ("may answer key ako", "sagot ko exam mo", "peke na school id"):
            self.assertTrue(
                ScreeningRule.objects.filter(phrase=phrase, kind="prohibited").exists(), phrase
            )
        for phrase in ("bayad muna", "gcash muna"):
            self.assertTrue(
                ScreeningRule.objects.filter(phrase=phrase, kind="scam").exists(), phrase
            )

    def test_switching_a_taglish_phrase_off_lets_the_listing_through(self):
        rule = ScreeningRule.objects.get(phrase="bayad muna")
        self.client  # noqa: B018 - the test is about the rules path, not HTTP
        rule.is_active = False
        rule.save(update_fields=["is_active"])

        verdict = StubProvider().screen(
            self.subject("Second-hand phone", "Bayad muna bago tayo magkita sa campus.")
        )

        self.assertEqual(verdict.verdict, "clean")

        rule.is_active = True
        rule.save(update_fields=["is_active"])
