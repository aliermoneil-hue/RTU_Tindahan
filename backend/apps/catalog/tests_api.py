"""API tests for the catalogue: visibility, ownership, and moderation."""

from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.catalog.models import Category, Listing, ListingPhoto


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
        self.make_listing(status=Listing.Status.APPROVED)
        self.make_listing(title="Hidden", status=Listing.Status.PENDING_SCREENING)

        response = self.client.get("/api/v1/listings/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [row["title"] for row in response.json()["results"]], ["Fresh Lumpia"]
        )

    def test_seller_sees_their_own_pending_listing(self):
        self.make_listing(status=Listing.Status.PENDING_SCREENING)
        self.client.force_authenticate(self.seller)

        response = self.client.get("/api/v1/listings/")

        self.assertEqual(
            [row["title"] for row in response.json()["results"]], ["Fresh Lumpia"]
        )

    def test_filters_by_category_and_search(self):
        self.make_listing(status=Listing.Status.APPROVED)
        self.make_listing(
            title="Notebook",
            description="Ruled, 80 leaves.",
            status=Listing.Status.APPROVED,
        )

        by_search = self.client.get("/api/v1/listings/?search=notebook")
        by_category = self.client.get("/api/v1/listings/?category=snacks")

        self.assertEqual([row["title"] for row in by_search.json()["results"]], ["Notebook"])
        self.assertEqual(len(by_category.json()["results"]), 2)

    def test_detail_counts_a_view(self):
        listing = self.make_listing(status=Listing.Status.APPROVED)

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
        self.assertEqual(listing.status, Listing.Status.PENDING_SCREENING)
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
        listing = self.make_listing(status=Listing.Status.APPROVED)
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
        # Smallest valid PNG: DRF verifies it with Pillow.
        png = (
            b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
            b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01"
            b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
        )
        image = SimpleUploadedFile("photo.png", png, content_type="image/png")

        response = self.client.post(
            "/api/v1/listings/",
            {**self.payload(), "upload_photos": [image]},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        listing = Listing.objects.get(slug=response.json()["slug"])
        self.assertEqual(listing.photos.count(), 1)

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
        self.assertEqual(listing.status, Listing.Status.REJECTED)
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
