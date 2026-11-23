"""API tests for the catalogue: visibility, ownership, and moderation."""

import io

from PIL import Image

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.catalog.models import Category, Listing, ListingPhoto


def png_bytes(width=100, height=100):
    """A real PNG of the given size, so Pillow can read its dimensions."""
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), "white").save(buffer, "PNG")
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


@override_settings(SCREENING_PROVIDER="stub")
class ListingApiTests(APITestCase):
    def setUp(self):
        self.category = Category.objects.create(name="Snacks")
        self.seller = make_user("2024-123456@rtu.edu.ph")
        self.other = make_user("2024-654321@rtu.edu.ph")
        self.moderator = make_user("moderator@rtu.edu.ph", role=User.Role.MODERATOR)

    def make_listing(self, **overrides):
        data = {
            "seller": self.seller,
            "category": self.category,
            "title": "Fresh Lumpia",
            "description": "Ready at the main gate.",
            "listing_type": Listing.Type.PRODUCT,
            "condition": Listing.Condition.NEW,
            "price": "50.00",
            "quantity": 3,
            "meetup_place": "Main gate",
        }
        data.update(overrides)
        return Listing.objects.create(**data)

    def payload(self, **overrides):
        data = {
            "category": self.category.pk,
            "title": "Ballpen",
            "description": "Blue ballpen, unused.",
            "listing_type": "product",
            "condition": "new",
            "price": "10.00",
            "quantity": 1,
            "meetup_place": "Library",
        }
        data.update(overrides)
        return data

    # -- reading -----------------------------------------------------------

    def test_anonymous_sees_only_approved_listings(self):
        self.make_listing(moderation_status=Listing.ModerationStatus.APPROVED)
        self.make_listing(title="Hidden", moderation_status=Listing.ModerationStatus.PENDING_SCREENING)

        response = self.client.get("/api/v1/listings/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [row["title"] for row in response.json()["results"]], ["Fresh Lumpia"]
        )

    def test_a_seller_does_not_see_their_pending_listing_in_the_marketplace(self):
        # The bug this guards: a signed-in seller used to receive their own
        # pending rows from the bare /listings/ call, which is the marketplace
        # feed, so a brand-new item appeared in the shop before approval.
        self.make_listing(moderation_status=Listing.ModerationStatus.PENDING_SCREENING)
        self.client.force_authenticate(self.seller)

        response = self.client.get("/api/v1/listings/")

        self.assertEqual(response.json()["results"], [])

    def test_a_seller_can_ask_for_their_own_listings(self):
        pending = self.make_listing(
            moderation_status=Listing.ModerationStatus.PENDING_SCREENING
        )
        self.make_listing(
            title="Someone else's",
            seller=self.other,
            moderation_status=Listing.ModerationStatus.PENDING_SCREENING,
        )
        self.client.force_authenticate(self.seller)

        response = self.client.get("/api/v1/listings/?seller=me")

        self.assertEqual(
            [row["title"] for row in response.json()["results"]], [pending.title]
        )

    def test_a_seller_can_open_their_own_pending_listing(self):
        # The page opened right after publishing reads the detail endpoint, and
        # so does the edit screen.
        listing = self.make_listing(
            moderation_status=Listing.ModerationStatus.PENDING_SCREENING
        )
        self.client.force_authenticate(self.seller)

        response = self.client.get(f"/api/v1/listings/{listing.slug}/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["moderation_status"], "pending_screening")

    def test_a_seller_cannot_open_another_sellers_pending_listing(self):
        listing = self.make_listing(
            moderation_status=Listing.ModerationStatus.PENDING_SCREENING
        )
        self.client.force_authenticate(self.other)

        response = self.client.get(f"/api/v1/listings/{listing.slug}/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # -- fulfillment method (what the cart needs to finish a request) -------

    def test_a_new_listing_defaults_to_campus_pickup(self):
        self.client.force_authenticate(self.seller)
        response = self.client.post("/api/v1/listings/", self.payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()["fulfillment"], "pickup")
        self.assertEqual(
            Listing.objects.get(slug=response.json()["slug"]).fulfillment, "pickup"
        )

    def test_a_seller_can_offer_pickup_and_delivery(self):
        self.client.force_authenticate(self.seller)
        response = self.client.post(
            "/api/v1/listings/", self.payload(fulfillment="both"), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()["fulfillment"], "both")

    def test_an_unknown_fulfillment_method_is_rejected(self):
        self.client.force_authenticate(self.seller)
        response = self.client.post(
            "/api/v1/listings/", self.payload(fulfillment="teleport"), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("fulfillment", response.json())

    def test_the_read_payload_carries_the_fulfillment_method(self):
        self.make_listing(
            moderation_status=Listing.ModerationStatus.APPROVED, fulfillment="delivery"
        )

        response = self.client.get("/api/v1/listings/")

        self.assertEqual(response.json()["results"][0]["fulfillment"], "delivery")

    def test_filters_by_category_and_search(self):
        self.make_listing(moderation_status=Listing.ModerationStatus.APPROVED)
        self.make_listing(
            title="Notebook",
            description="Ruled, 80 leaves.",
            moderation_status=Listing.ModerationStatus.APPROVED,
        )

        by_search = self.client.get("/api/v1/listings/?search=notebook")
        by_category = self.client.get("/api/v1/listings/?category=snacks")

        self.assertEqual([row["title"] for row in by_search.json()["results"]], ["Notebook"])
        self.assertEqual(len(by_category.json()["results"]), 2)

    # -- browsing: price range and sales ordering (BD-03, BD-06) -----------

    def test_price_filters_are_inclusive_and_combinable(self):
        self.make_listing(title="Candy", price="10.00", moderation_status=Listing.ModerationStatus.APPROVED)
        self.make_listing(title="Lumpia", price="50.00", moderation_status=Listing.ModerationStatus.APPROVED)
        self.make_listing(title="Jacket", price="500.00", moderation_status=Listing.ModerationStatus.APPROVED)

        def titles(query):
            response = self.client.get(f"/api/v1/listings/?{query}")
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            return sorted(row["title"] for row in response.json()["results"])

        self.assertEqual(titles("max_price=50"), ["Candy", "Lumpia"])
        self.assertEqual(titles("min_price=50"), ["Jacket", "Lumpia"])
        self.assertEqual(titles("min_price=10&max_price=50"), ["Candy", "Lumpia"])
        self.assertEqual(titles("min_price=500.01"), [])

    def test_an_unreadable_price_is_reported_not_ignored(self):
        response = self.client.get("/api/v1/listings/?max_price=cheap")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("max_price", response.json())

    def test_an_inverted_price_range_is_reported(self):
        response = self.client.get("/api/v1/listings/?min_price=100&max_price=10")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("max_price", response.json())

    def test_a_negative_price_is_reported(self):
        response = self.client.get("/api/v1/listings/?min_price=-5")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("min_price", response.json())

    def test_best_selling_orders_by_units_sold(self):
        self.make_listing(title="Quiet", moderation_status=Listing.ModerationStatus.APPROVED, sold_count=0)
        self.make_listing(title="Steady", moderation_status=Listing.ModerationStatus.APPROVED, sold_count=5)
        self.make_listing(title="Brisk", moderation_status=Listing.ModerationStatus.APPROVED, sold_count=12)

        best = self.client.get("/api/v1/listings/?ordering=best-selling")
        least = self.client.get("/api/v1/listings/?ordering=least-sold")

        self.assertEqual(
            [row["title"] for row in best.json()["results"]],
            ["Brisk", "Steady", "Quiet"],
        )
        self.assertEqual(
            [row["title"] for row in least.json()["results"]],
            ["Quiet", "Steady", "Brisk"],
        )

    # -- screening and the moderator queue (AI-01, AI-03) ------------------

    def test_posting_a_prohibited_item_lands_in_review(self):
        self.client.force_authenticate(self.seller)

        response = self.client.post(
            "/api/v1/listings/",
            self.payload(
                title="Counterfeit RTU ID",
                description="Fake student identification, looks exactly like the real one.",
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()["status"], "needs_review")

    def test_a_clean_listing_still_waits_for_a_moderator(self):
        self.client.force_authenticate(self.seller)

        response = self.client.post("/api/v1/listings/", self.payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()["status"], "pending_screening")

    def test_screening_reasons_reach_a_moderator_only(self):
        self.client.force_authenticate(self.seller)
        posted = self.client.post(
            "/api/v1/listings/",
            self.payload(
                title="Answer key",
                description="Complete exam answers for the midterm, message me.",
            ),
            format="json",
        )
        slug = posted.json()["slug"]

        self.assertIsNone(posted.json()["screening"])

        self.client.force_authenticate(self.moderator)
        seen = self.client.get(f"/api/v1/listings/{slug}/")

        self.assertEqual(seen.json()["screening"]["verdict"], "flagged")
        self.assertTrue(seen.json()["screening"]["reasons"])

    def test_the_moderator_queue_asks_for_a_status(self):
        self.make_listing(title="Live one", moderation_status=Listing.ModerationStatus.APPROVED)
        self.make_listing(title="Waiting one", moderation_status=Listing.ModerationStatus.PENDING_SCREENING)
        self.make_listing(title="Flagged one", moderation_status=Listing.ModerationStatus.NEEDS_REVIEW)

        self.client.force_authenticate(self.moderator)
        waiting = self.client.get("/api/v1/listings/?status=pending_screening")
        queue = self.client.get(
            "/api/v1/listings/?status=pending_screening,needs_review"
        )

        self.assertEqual(
            [row["title"] for row in waiting.json()["results"]], ["Waiting one"]
        )
        self.assertEqual(len(queue.json()["results"]), 2)

    def test_a_visitor_cannot_use_status_to_see_hidden_listings(self):
        self.make_listing(moderation_status=Listing.ModerationStatus.PENDING_SCREENING)

        response = self.client.get("/api/v1/listings/?status=pending_screening")

        self.assertEqual(response.json()["count"], 0)

    def test_an_unknown_status_is_reported(self):
        response = self.client.get("/api/v1/listings/?status=banana")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("status", response.json())

    def test_detail_counts_a_view(self):
        listing = self.make_listing(moderation_status=Listing.ModerationStatus.APPROVED)

        self.client.get(f"/api/v1/listings/{listing.slug}/")

        listing.refresh_from_db()
        self.assertEqual(listing.view_count, 1)

    # -- writing -----------------------------------------------------------

    def test_posting_requires_a_signed_in_member(self):
        response = self.client.post("/api/v1/listings/", self.payload(), format="json")

        self.assertIn(
            response.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )
        self.assertEqual(Listing.objects.count(), 0)

    def test_verified_member_posting_waits_for_screening(self):
        self.client.force_authenticate(self.seller)

        response = self.client.post("/api/v1/listings/", self.payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        listing = Listing.objects.get(slug=response.json()["slug"])
        self.assertEqual(listing.seller, self.seller)
        self.assertEqual(listing.moderation_status, Listing.ModerationStatus.PENDING_SCREENING)
        self.assertFalse(listing.is_published)

    def test_cannot_publish_is_official_over_http(self):
        self.client.force_authenticate(self.seller)

        response = self.client.post(
            "/api/v1/listings/", self.payload(is_official=True), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(Listing.objects.get().is_official)

    def test_service_needs_not_applicable_condition(self):
        self.client.force_authenticate(self.seller)

        response = self.client.post(
            "/api/v1/listings/",
            self.payload(listing_type="service", condition="new"),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("condition", response.json())

    def test_a_seller_cannot_edit_someone_elses_listing(self):
        listing = self.make_listing(moderation_status=Listing.ModerationStatus.APPROVED)
        self.client.force_authenticate(self.other)

        response = self.client.patch(
            f"/api/v1/listings/{listing.slug}/", {"price": "1.00"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        listing.refresh_from_db()
        self.assertEqual(str(listing.price), "50.00")

    def test_a_stranger_cannot_even_see_someone_elses_pending_listing(self):
        listing = self.make_listing()
        self.client.force_authenticate(self.other)

        response = self.client.get(f"/api/v1/listings/{listing.slug}/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_photos_are_uploaded_as_multipart(self):
        self.client.force_authenticate(self.seller)
        # 100 x 100 is the guideline's minimum, so this is a valid photo.
        image = SimpleUploadedFile(
            "photo.png", png_bytes(), content_type="image/png"
        )

        response = self.client.post(
            "/api/v1/listings/",
            {**self.payload(), "upload_photos": [image]},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        listing = Listing.objects.get(slug=response.json()["slug"])
        self.assertEqual(listing.photos.count(), 1)

    def test_a_thumbnail_smaller_than_100_pixels_is_refused(self):
        self.client.force_authenticate(self.seller)
        image = SimpleUploadedFile(
            "thumb.png", png_bytes(99, 99), content_type="image/png"
        )

        response = self.client.post(
            "/api/v1/listings/",
            {**self.payload(), "upload_photos": [image]},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("upload_photos", response.json())

    # -- moderation --------------------------------------------------------

    def test_only_a_moderator_can_approve(self):
        listing = self.make_listing()
        self.client.force_authenticate(self.seller)
        refused = self.client.post(f"/api/v1/listings/{listing.slug}/approve/")
        self.assertEqual(refused.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.moderator)
        allowed = self.client.post(f"/api/v1/listings/{listing.slug}/approve/")

        self.assertEqual(allowed.status_code, status.HTTP_200_OK)
        listing.refresh_from_db()
        self.assertTrue(listing.is_published)

    def test_rejecting_requires_a_reason(self):
        listing = self.make_listing()
        self.client.force_authenticate(self.moderator)

        missing = self.client.post(
            f"/api/v1/listings/{listing.slug}/reject/", {}, format="json"
        )
        given = self.client.post(
            f"/api/v1/listings/{listing.slug}/reject/",
            {"reason": "Prohibited item."},
            format="json",
        )

        self.assertEqual(missing.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(given.status_code, status.HTTP_200_OK)
        listing.refresh_from_db()
        self.assertEqual(listing.moderation_status, Listing.ModerationStatus.REJECTED)
        self.assertEqual(listing.rejection_reason, "Prohibited item.")


class CategoryApiTests(APITestCase):
    def test_public_category_list_hides_inactive_categories(self):
        Category.objects.create(name="Snacks")
        Category.objects.create(name="Retired", is_active=False)

        response = self.client.get("/api/v1/categories/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([row["name"] for row in response.json()], ["Snacks"])


class ListingPhotoModelTests(APITestCase):
    def test_photo_belongs_to_the_listing_that_uploaded_it(self):
        category = Category.objects.create(name="Snacks")
        seller = make_user("2024-123456@rtu.edu.ph")
        listing = Listing.objects.create(
            seller=seller,
            category=category,
            title="Lumpia",
            description="Homemade.",
            listing_type=Listing.Type.PRODUCT,
            condition=Listing.Condition.NEW,
            price="50.00",
            quantity=1,
            meetup_place="Main gate",
        )

        ListingPhoto.objects.create(listing=listing, image="listings/a.jpg")

        self.assertEqual(listing.photos.count(), 1)


@override_settings(SCREENING_PROVIDER="stub")
class SmallSellerSortTests(APITestCase):
    """The "small sellers" sort: a verified student with a tiny live catalogue.

    The cutoff is a product decision (3 listings by default), so it lives in
    settings and the test proves both the flag and the ordering.
    """

    def setUp(self):
        self.category = Category.objects.create(name="School supplies")
        self.small = make_user("2024-111111@rtu.edu.ph")
        self.big = make_user("2024-222222@rtu.edu.ph")
        self.staff = make_user("staff@rtu.edu.ph", role=User.Role.OFFICE_STAFF)
        self.staff.member_type = User.MemberType.PERSONNEL
        self.staff.year_level = None
        self.staff.save(update_fields=["member_type", "year_level"])

    def approved(self, seller, title):
        return Listing.objects.create(
            seller=seller,
            category=self.category,
            title=title,
            description="Good condition, complete, pick up at the main gate.",
            listing_type=Listing.Type.PRODUCT,
            condition=Listing.Condition.USED,
            price="300.00",
            quantity=1,
            meetup_place="Main gate",
            moderation_status=Listing.ModerationStatus.APPROVED,
            availability_status=Listing.AvailabilityStatus.AVAILABLE,
        )

    def test_a_student_with_few_listings_is_small_and_comes_first(self):
        for index in range(2):
            self.approved(self.small, f"Small seller item {index}")
        for index in range(4):
            self.approved(self.big, f"Big seller item {index}")
        self.approved(self.staff, "Official store uniform")

        response = self.client.get("/api/v1/listings/?ordering=small-sellers")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        rows = response.json()["results"]
        self.assertEqual(len(rows), 7)
        # Two small-seller rows first, then the one-listing staff seller, then
        # the four-listing student.
        self.assertEqual(
            [row["seller_name"] for row in rows],
            ["2024-111111", "2024-111111", "staff", "2024-222222", "2024-222222",
             "2024-222222", "2024-222222"],
        )
        self.assertTrue(all(row["is_small_seller"] for row in rows[:2]))
        self.assertFalse(any(row["is_small_seller"] for row in rows[2:]))
        self.assertEqual(rows[0]["seller_active_listings"], 2)
        self.assertEqual(rows[-1]["seller_active_listings"], 4)

    @override_settings(SMALL_SELLER_MAX_LISTINGS=1)
    def test_the_cutoff_is_configurable(self):
        self.approved(self.small, "Small seller item one")
        self.approved(self.small, "Small seller item two")

        response = self.client.get("/api/v1/listings/?ordering=small-sellers")

        rows = response.json()["results"]
        self.assertFalse(any(row["is_small_seller"] for row in rows))
        self.assertEqual({row["seller_active_listings"] for row in rows}, {2})

    def test_unapproved_and_sold_listings_do_not_count(self):
        self.approved(self.small, "Live item")
        Listing.objects.create(
            seller=self.small,
            category=self.category,
            title="Waiting for a moderator",
            description="This one is not published yet, so it does not count.",
            listing_type=Listing.Type.PRODUCT,
            condition=Listing.Condition.USED,
            price="300.00",
            quantity=1,
            meetup_place="Main gate",
            moderation_status=Listing.ModerationStatus.NEEDS_REVIEW,
        )

        response = self.client.get("/api/v1/listings/?ordering=small-sellers")

        row = next(r for r in response.json()["results"] if r["seller_name"] == "2024-111111")
        self.assertEqual(row["seller_active_listings"], 1)
        self.assertTrue(row["is_small_seller"])


class OwnerDetailRouteTests(APITestCase):
    """A listing waiting for approval must still be editable by its seller.

    The detail queryset used to be owner-permissive only for GET, so PATCH and
    DELETE on a pending listing answered 404 even to the person who posted it.
    """

    def setUp(self):
        self.category = Category.objects.create(name="Snacks")
        self.seller = make_user("2024-333333@rtu.edu.ph")
        self.other = make_user("2024-444444@rtu.edu.ph")

    def pending(self):
        return Listing.objects.create(
            seller=self.seller,
            category=self.category,
            title="Waiting for approval",
            description="A real listing that no moderator has looked at yet.",
            listing_type=Listing.Type.PRODUCT,
            condition=Listing.Condition.USED,
            price="100.00",
            quantity=1,
            meetup_place="Main gate",
            moderation_status=Listing.ModerationStatus.PENDING_SCREENING,
        )

    def test_the_seller_can_edit_a_pending_listing(self):
        listing = self.pending()
        self.client.force_authenticate(self.seller)

        response = self.client.patch(
            f"/api/v1/listings/{listing.slug}/", {"price": "125.00"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        listing.refresh_from_db()
        self.assertEqual(str(listing.price), "125.00")

    def test_the_seller_can_delete_a_pending_listing(self):
        listing = self.pending()
        self.client.force_authenticate(self.seller)

        response = self.client.delete(f"/api/v1/listings/{listing.slug}/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Listing.objects.filter(pk=listing.pk).exists())

    def test_a_stranger_still_cannot_touch_it(self):
        listing = self.pending()
        self.client.force_authenticate(self.other)

        response = self.client.delete(f"/api/v1/listings/{listing.slug}/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(Listing.objects.filter(pk=listing.pk).exists())

    def test_your_own_pending_listing_stays_out_of_the_marketplace(self):
        listing = self.pending()
        self.client.force_authenticate(self.seller)

        response = self.client.get("/api/v1/listings/")

        slugs = [row["slug"] for row in response.json()["results"]]
        self.assertNotIn(listing.slug, slugs)
