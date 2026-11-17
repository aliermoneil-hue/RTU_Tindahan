from django.core.exceptions import ValidationError
from django.test import TestCase
from django.utils import timezone

from apps.accounts.models import User
from apps.accounts.validators import (
    student_number_from_email,
    validate_rtu_email,
)


class UserModelTests(TestCase):
    def test_create_user_defaults_to_visitor_and_unverified(self):
        user = User.objects.create_user(
            email="2024-123456@rtu.edu.ph",
            display_name="Juan Dela Cruz",
            password="SecurePass123!",
        )

        self.assertEqual(user.role, User.Role.VISITOR)
        self.assertEqual(user.status, User.Status.ACTIVE)
        self.assertFalse(user.is_verified)
        self.assertFalse(user.is_rtu_member)
        self.assertTrue(user.check_password("SecurePass123!"))

    def test_email_is_normalised(self):
        user = User.objects.create_user(
            email="2024-123456@RTU.EDU.PH",
            display_name="Juan Dela Cruz",
            password="SecurePass123!",
        )
        self.assertEqual(user.email, "2024-123456@rtu.edu.ph")

    def test_verify_promotes_visitor_to_verified_user(self):
        user = User.objects.create_user(
            email="2024-123456@rtu.edu.ph",
            display_name="Juan Dela Cruz",
            password="SecurePass123!",
        )

        user.verify()

        self.assertTrue(user.is_verified)
        self.assertTrue(user.is_rtu_member)
        self.assertEqual(user.role, User.Role.USER)
        self.assertIsNotNone(user.verified_at)

    def test_verify_is_idempotent(self):
        user = User.objects.create_user(
            email="2024-123456@rtu.edu.ph",
            display_name="Juan Dela Cruz",
            password="SecurePass123!",
        )
        user.verify()
        first = user.verified_at

        user.verify()

        self.assertEqual(user.verified_at, first)

    def test_create_superuser_has_administrator_role(self):
        admin = User.objects.create_superuser(
            email="admin@rtu.edu.ph",
            display_name="System Administrator",
            password="SecurePass123!",
        )

        self.assertEqual(admin.role, User.Role.ADMINISTRATOR)
        self.assertTrue(admin.is_staff)
        self.assertTrue(admin.is_superuser)
        self.assertTrue(admin.is_verified)
        self.assertTrue(admin.is_administrator)

    def test_student_requires_year_level(self):
        user = User(
            email="2024-123456@rtu.edu.ph",
            display_name="Juan Dela Cruz",
            member_type=User.MemberType.STUDENT,
            year_level=None,
            college="College of ICT",
        )

        with self.assertRaises(ValidationError):
            user.clean()

    def test_non_student_cannot_have_year_level(self):
        user = User(
            email="juan@rtu.edu.ph",
            display_name="Juan Dela Cruz",
            member_type=User.MemberType.FACULTY,
            year_level=2,
            college="College of ICT",
        )

        with self.assertRaises(ValidationError):
            user.clean()

    def test_can_sign_in_is_false_when_suspended(self):
        user = User.objects.create_user(
            email="2024-123456@rtu.edu.ph",
            display_name="Juan Dela Cruz",
            password="SecurePass123!",
        )
        user.status = User.Status.SUSPENDED
        user.status_changed_at = timezone.now()

        self.assertFalse(user.can_sign_in)


class RtuEmailValidatorTests(TestCase):
    def test_rejects_non_rtu_domain(self):
        with self.assertRaises(ValidationError):
            validate_rtu_email("juan@gmail.com", "student")

    def test_student_requires_student_number_form(self):
        with self.assertRaises(ValidationError):
            validate_rtu_email("juan.delacruz@rtu.edu.ph", "student")

    def test_student_number_form_is_accepted(self):
        self.assertEqual(
            validate_rtu_email("2024-123456@rtu.edu.ph", "student"),
            "2024-123456@rtu.edu.ph",
        )

    def test_faculty_may_use_name_address(self):
        self.assertEqual(
            validate_rtu_email("juan.delacruz@rtu.edu.ph", "faculty"),
            "juan.delacruz@rtu.edu.ph",
        )

    def test_student_number_is_extracted(self):
        self.assertEqual(
            student_number_from_email("2024-123456@rtu.edu.ph"), "2024-123456"
        )
