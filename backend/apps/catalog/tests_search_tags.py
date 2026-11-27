"""Search keywords read off a listing's photos (BD-01 extension).

The reported symptom this covers: typing "blue" into the search bar answered
nothing, because the only listing that mentioned blue had it in the description
("Upuan — Kulay blue at orange") and the search never read that column, while
the colour of everything else existed only in the picture.

Two halves are pinned here: the search now reads the description and the stored
keywords, and a posted picture is read once for those keywords — with the
model's answer stubbed, so the suite stays offline.
"""

import io
from unittest import mock

from PIL import Image

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.catalog.indexing import read_keywords, stamp_search_tags
from apps.catalog.models import Category, Listing, ListingPhoto
from apps.screening import keywords as keyword_reader


def png_bytes(width=100, height=100, colour="white"):
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), colour).save(buffer, "PNG")
    return buffer.getvalue()


def make_user(email, role=User.Role.USER, **extra):
    user = User.objects.create_user(
        email=email,
        display_name=email.split("@")[0],
        password="SecurePass123!",
        member_type=User.MemberType.STUDENT,
        college="College of ICT",
        year_level=2,
        **extra,
    )
    user.role = role
    user.verify()
    return user


@override_settings(SCREENING_PROVIDER="stub", SCREENING_IMAGES="off")
class SearchTagsApiTests(APITestCase):
    def setUp(self):
        self.category = Category.objects.create(name="School Supplies")
        self.seller = make_user("2024-300001@rtu.edu.ph")

    def payload(self, **overrides):
        data = {
            "category": self.category.pk,
            "title": "Upuan",
            "description": "Kulay blue at orange",
            "listing_type": "product",
            "condition": "used",
            "price": "250.00",
            "quantity": 1,
            "meetup_place": "Main lobby",
        }
        data.update(overrides)
        return data

    def make_listing(self, **overrides):
        data = {
            "seller": self.seller,
            "category": self.category,
            "title": "Upuan",
            "description": "Kulay blue at orange",
            "listing_type": Listing.Type.PRODUCT,
            "condition": Listing.Condition.USED,
            "price": "250.00",
            "quantity": 1,
            "meetup_place": "Main lobby",
            "moderation_status": Listing.ModerationStatus.APPROVED,
            "availability_status": Listing.AvailabilityStatus.AVAILABLE,
        }
        data.update(overrides)
        return Listing.objects.create(**data)

    # -- the reported bug ---------------------------------------------------

    def test_a_word_in_the_description_is_findable(self):
        """The exact case: "Kulay blue at orange" was invisible to search."""
        self.make_listing()
        response = self.client.get("/api/v1/listings/?search=blue")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        labels = [row["title"] for row in response.json()["results"]]
        self.assertEqual(labels, ["Upuan"])

    def test_a_keyword_from_the_photo_is_findable(self):
        """Nothing the seller typed says "blue"; the picture did."""
        self.make_listing(
            title="Upuan", description="Maayos pa.", search_tags="upuan blue orange plastic"
        )
        response = self.client.get("/api/v1/listings/?search=blue")
        self.assertEqual([r["title"] for r in response.json()["results"]], ["Upuan"])

    def test_a_search_that_matches_nothing_still_answers_empty(self):
        self.make_listing()
        response = self.client.get("/api/v1/listings/?search=refrigerator")
        self.assertEqual(response.json()["count"], 0)

    def test_the_keywords_are_public_because_the_client_searches_them(self):
        listing = self.make_listing(search_tags="upuan blue orange")
        response = self.client.get(f"/api/v1/listings/{listing.slug}/")
        self.assertEqual(response.json()["search_tags"], "upuan blue orange")

    # -- posting reads the picture once -------------------------------------

    def test_posting_with_a_photo_stores_the_keywords_it_read(self):
        self.client.force_authenticate(self.seller)
        image = SimpleUploadedFile("photo.png", png_bytes(), content_type="image/png")

        with mock.patch(
            "apps.screening.keywords.get_keyword_provider",
            return_value=mock.Mock(describe=mock.Mock(return_value=["Upuan", "blue", "Orange"])),
        ):
            response = self.client.post(
                "/api/v1/listings/",
                {**self.payload(), "upload_photos": [image]},
                format="multipart",
            )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        listing = Listing.objects.get(slug=response.json()["slug"])
        self.assertEqual(listing.search_tags, "upuan blue orange")
        self.assertEqual(response.json()["search_tags"], "upuan blue orange")

    def test_a_failing_extractor_does_not_block_the_post(self):
        self.client.force_authenticate(self.seller)
        image = SimpleUploadedFile("photo.png", png_bytes(), content_type="image/png")

        with mock.patch(
            "apps.screening.keywords.get_keyword_provider",
            side_effect=RuntimeError("model down"),
        ):
            response = self.client.post(
                "/api/v1/listings/",
                {**self.payload(), "upload_photos": [image]},
                format="multipart",
            )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        listing = Listing.objects.get(slug=response.json()["slug"])
        self.assertEqual(listing.search_tags, "")
        # ...and the listing is still found by its own words.
        self.assertEqual(
            self.client.get("/api/v1/listings/?search=upuan").json()["count"], 0
        )

    def test_no_keywords_are_a_normal_state(self):
        """Without a provider (the stub suite) nothing is invented."""
        listing = self.make_listing()
        ListingPhoto.objects.create(listing=listing, image="listings/probe.jpg")
        self.assertEqual(stamp_search_tags(listing), "")

    def test_a_long_phrase_is_not_re_normalised_away(self):
        """Measured on a real bench photo: seven words, 48 characters, all lost.

        `read_keywords` used to pass the already-joined phrase back through
        `normalise`, which is a word-list function and dropped it for being
        longer than MAX_WORD_LENGTH. The listing then had no keywords at all
        while the model had answered perfectly.
        """
        listing = self.make_listing()
        ListingPhoto.objects.create(
            listing=listing,
            image=SimpleUploadedFile("photo.png", png_bytes(), content_type="image/png"),
        )
        answer = ["wooden", "bench", "long", "wood", "metal", "orange", "blue", "white"]
        with mock.patch(
            "apps.screening.keywords.get_keyword_provider",
            return_value=mock.Mock(describe=mock.Mock(return_value=answer)),
        ):
            words = read_keywords(listing)

        self.assertEqual(
            words, "wooden bench long wood metal orange blue white"
        )

    # -- the extractor's own contract ---------------------------------------

    def test_normalise_folds_case_deduplicates_and_bounds(self):
        phrase = keyword_reader.normalise(
            ["Upuan", "blue", "blue", "Orange", "  plastic ", "", "x" * 40]
        )
        self.assertEqual(phrase, "upuan blue orange plastic")

    def test_normalise_caps_the_phrase_at_the_column_length(self):
        phrase = keyword_reader.normalise([f"word{i}" for i in range(40)])
        self.assertLessEqual(len(phrase), 300)
        self.assertEqual(len(phrase.split()), keyword_reader.MAX_WORDS)

    def test_the_model_answer_is_parsed_from_the_response_body(self):
        body = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {
                                "text": '{"subject": "scientific calculator", '
                                '"keywords": ["casio", "fx-991ex", "black", "solar"]}'
                            }
                        ]
                    }
                }
            ]
        }
        self.assertEqual(
            keyword_reader.words_from_answer(body),
            ["scientific calculator", "casio", "fx-991ex", "black", "solar"],
        )

    def test_a_refusal_or_error_body_yields_no_words(self):
        self.assertEqual(keyword_reader.words_from_answer({}), [])
        self.assertEqual(keyword_reader.words_from_answer({"candidates": []}), [])
        self.assertEqual(
            keyword_reader.words_from_answer(
                {"candidates": [{"content": {"parts": [{"text": "I cannot help with that."}]}}]}
            ),
            [],
        )

    @override_settings(KEYWORDS_ENABLED=False)
    def test_the_switch_turns_indexing_off(self):
        self.assertIsNone(keyword_reader.get_keyword_provider())

    # -- backfill ------------------------------------------------------------

    def test_the_backfill_reports_without_writing_on_a_dry_run(self):
        listing = self.make_listing()
        ListingPhoto.objects.create(
            listing=listing,
            image=SimpleUploadedFile("photo.png", png_bytes(), content_type="image/png"),
        )

        out = io.StringIO()
        with mock.patch(
            "apps.screening.keywords.get_keyword_provider",
            return_value=mock.Mock(describe=mock.Mock(return_value=["blue"])),
        ):
            call_command("backfill_search_tags", "--dry-run", stdout=out)

        listing.refresh_from_db()
        self.assertEqual(listing.search_tags, "")
        self.assertIn("would read", out.getvalue())

    def test_the_backfill_fills_rows_that_are_missing_keywords(self):
        listing = self.make_listing()
        ListingPhoto.objects.create(
            listing=listing,
            image=SimpleUploadedFile("photo.png", png_bytes(), content_type="image/png"),
        )

        with mock.patch(
            "apps.screening.keywords.get_keyword_provider",
            return_value=mock.Mock(describe=mock.Mock(return_value=["upuan", "blue"])),
        ):
            call_command("backfill_search_tags", stdout=io.StringIO())

        listing.refresh_from_db()
        self.assertEqual(listing.search_tags, "upuan blue")
        self.assertEqual(
            self.client.get("/api/v1/listings/?search=orange").json()["count"], 1
        )
