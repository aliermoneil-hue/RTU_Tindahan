from decimal import Decimal

from django.core.exceptions import ValidationError
from django.test import TestCase

from apps.accounts.models import User
from apps.catalog.models import Category, Listing, ListingPhoto


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


class CategoryTests(TestCase):
    def test_slug_is_generated(self):
        category = Category.objects.create(name="Food and Snacks")
        self.assertEqual(category.slug, "food-and-snacks")

    def test_existing_slug_is_not_changed(self):
        category = Category.objects.create(name="Food and Snacks")
        category.name = "Snacks"
        category.save()
        self.assertEqual(category.slug, "food-and-snacks")


class ListingTests(TestCase):
    def setUp(self):
        self.category = Category.objects.create(name="Food and Snacks")
        self.student = make_user("2024-123456@rtu.edu.ph")
        self.staff = make_user(
            "staff@rtu.edu.ph", role=User.Role.OFFICE_STAFF
        )

    def make_listing(self, **overrides):
        data = {
            "seller": self.student,
            "category": self.category,
            "title": "Fresh Lumpia",
            "description": "Homemade lumpia, ready at the main gate.",
            "listing_type": Listing.Type.PRODUCT,
            "condition": Listing.Condition.NEW,
            "price": Decimal("50.00"),
            "quantity": 3,
            "meetup_place": "Main gate",
        }
        data.update(overrides)
        return Listing.objects.create(**data)

    def test_defaults_to_pending_screening(self):
        listing = self.make_listing()
        self.assertEqual(listing.status, Listing.Status.PENDING_SCREENING)
        self.assertFalse(listing.is_published)

    def test_service_requires_not_applicable_condition(self):
        listing = Listing(
            seller=self.student,
            category=self.category,
            title="Printing Service",
            description="Printing up to A4.",
            listing_type=Listing.Type.SERVICE,
            condition=Listing.Condition.NEW,
            price=Decimal("5.00"),
            quantity=1,
            meetup_place="Library",
        )

        with self.assertRaises(ValidationError):
            listing.full_clean()

    def test_official_listing_requires_office_staff(self):
        listing = Listing(
            seller=self.student,
            category=self.category,
            title="Official Uniform",
            description="RTU uniform.",
            listing_type=Listing.Type.PRODUCT,
            condition=Listing.Condition.NEW,
            price=Decimal("500.00"),
            quantity=1,
            meetup_place="OSA Office",
            is_official=True,
        )

        with self.assertRaises(ValidationError):
            listing.full_clean()

    def test_office_staff_can_publish_official_listing(self):
        listing = Listing(
            seller=self.staff,
            category=self.category,
            title="Official Uniform",
            description="RTU uniform.",
            listing_type=Listing.Type.PRODUCT,
            condition=Listing.Condition.NEW,
            price=Decimal("500.00"),
            quantity=1,
            meetup_place="OSA Office",
            is_official=True,
        )

        listing.full_clean()

    def test_price_must_be_positive(self):
        listing = Listing(
            seller=self.student,
            category=self.category,
            title="Free Item",
            description="Should fail validation.",
            listing_type=Listing.Type.PRODUCT,
            condition=Listing.Condition.NEW,
            price=Decimal("0.00"),
            quantity=1,
            meetup_place="Main gate",
        )

        with self.assertRaises(ValidationError):
            listing.full_clean()

    def test_slugs_are_unique(self):
        first = self.make_listing(title="Notebook")
        second = self.make_listing(title="Notebook")

        self.assertEqual(first.slug, "notebook")
        self.assertEqual(second.slug, "notebook-2")

    def test_approve_sets_published_at(self):
        listing = self.make_listing()

        listing.approve()
        listing.refresh_from_db()

        self.assertEqual(listing.status, Listing.Status.APPROVED)
        self.assertIsNotNone(listing.published_at)
        self.assertTrue(listing.is_published)


class ListingPhotoTests(TestCase):
    def test_photos_are_ordered(self):
        category = Category.objects.create(name="Food and Snacks")
        seller = make_user("2024-123456@rtu.edu.ph")
        listing = Listing.objects.create(
            seller=seller,
            category=category,
            title="Lumpia",
            description="Homemade.",
            listing_type=Listing.Type.PRODUCT,
            condition=Listing.Condition.NEW,
            price=Decimal("50.00"),
            quantity=1,
            meetup_place="Main gate",
        )

        second = ListingPhoto.objects.create(
            listing=listing, image="listings/b.jpg", sort_order=2
        )
        first = ListingPhoto.objects.create(
            listing=listing, image="listings/a.jpg", sort_order=1
        )

        self.assertEqual(list(listing.photos.all()), [first, second])