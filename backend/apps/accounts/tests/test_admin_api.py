from django.utils import timezone
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from apps.accounts.models import User

PASSWORD = "SecurePass123!"


def make_user(email, name, role=User.Role.USER, verified=True, **extra):
    extra.setdefault("member_type", User.MemberType.PERSONNEL)
    extra.setdefault("college", "Office of Student Affairs")
    if verified:
        extra["verified_at"] = timezone.now()
    return User.objects.create_user(
        email=email, display_name=name, password=PASSWORD, role=role, **extra
    )


class AdminApiTestCase(APITestCase):
    def setUp(self):
        self.admin = make_user("admin@rtu.edu.ph", "Admin One", User.Role.ADMINISTRATOR)
        self.admin2 = make_user("admin2@rtu.edu.ph", "Admin Two", User.Role.ADMINISTRATOR)
        self.staff = make_user("staff@rtu.edu.ph", "Office Staff", User.Role.OFFICE_STAFF)
        self.moderator = make_user("moderator@rtu.edu.ph", "Moderator", User.Role.MODERATOR)
        self.student = make_user(
            "2024-000001@rtu.edu.ph",
            "Demo Student",
            User.Role.USER,
            member_type=User.MemberType.STUDENT,
            college="College of Information and Communications Technology",
            year_level=2,
        )
        self.pending = make_user(
            "2024-000002@rtu.edu.ph",
            "Pending Student",
            User.Role.VISITOR,
            verified=False,
            member_type=User.MemberType.STUDENT,
            college="College of Engineering",
            year_level=1,
        )


class AdminAccessTests(AdminApiTestCase):
    def test_anonymous_is_rejected(self):
        for url in ("/api/v1/admin/users/", "/api/v1/admin/summary/"):
            self.assertEqual(self.client.get(url).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_verified_student_cannot_open_admin_endpoints(self):
        self.client.force_authenticate(self.student)
        for url in ("/api/v1/admin/users/", "/api/v1/admin/summary/"):
            self.assertEqual(self.client.get(url).status_code, status.HTTP_403_FORBIDDEN)

    def test_moderator_sees_summary_but_not_accounts(self):
        self.client.force_authenticate(self.moderator)
        self.assertEqual(self.client.get("/api/v1/admin/summary/").status_code, 200)
        self.assertEqual(self.client.get("/api/v1/admin/users/").status_code, 403)

    def test_office_staff_can_list_but_not_edit(self):
        self.client.force_authenticate(self.staff)
        self.assertEqual(self.client.get("/api/v1/admin/users/").status_code, 200)
        response = self.client.patch(
            f"/api/v1/admin/users/{self.student.pk}/", {"role": "moderator"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_suspended_administrator_loses_access(self):
        self.admin.status = User.Status.SUSPENDED
        self.admin.save()
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get("/api/v1/admin/users/").status_code, 403)


class AdminUserListTests(AdminApiTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.admin)

    def emails(self, query=""):
        response = self.client.get(f"/api/v1/admin/users/{query}")
        self.assertEqual(response.status_code, 200)
        return [row["email"] for row in response.json()["results"]]

    def test_list_is_paged_and_has_no_password(self):
        response = self.client.get("/api/v1/admin/users/")
        body = response.json()
        self.assertEqual(body["count"], 6)
        self.assertNotIn("password", body["results"][0])
        self.assertNotIn("profile_photo", body["results"][0])

    def test_search_matches_email_name_and_college(self):
        self.assertEqual(self.emails("?q=demo%20student"), ["2024-000001@rtu.edu.ph"])
        self.assertEqual(self.emails("?q=000002"), ["2024-000002@rtu.edu.ph"])
        self.assertEqual(self.emails("?q=engineering"), ["2024-000002@rtu.edu.ph"])

    def test_filters(self):
        self.assertEqual(self.emails("?verified=false"), ["2024-000002@rtu.edu.ph"])
        self.assertEqual(len(self.emails("?role=administrator")), 2)
        self.assertEqual(len(self.emails("?member_type=student")), 2)
        self.assertEqual(self.emails("?status=banned"), [])

    def test_unknown_filter_values_are_ignored(self):
        self.assertEqual(len(self.emails("?role=wizard&ordering=password")), 6)

    def test_ordering_and_page_size(self):
        response = self.client.get("/api/v1/admin/users/?ordering=email&page_size=2")
        body = response.json()
        self.assertEqual(len(body["results"]), 2)
        self.assertEqual(body["results"][0]["email"], "2024-000001@rtu.edu.ph")
        self.assertIsNotNone(body["next"])

    def test_detail_returns_one_account(self):
        response = self.client.get(f"/api/v1/admin/users/{self.student.pk}/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["student_number"], "2024-000001")
        self.assertEqual(self.client.get("/api/v1/admin/users/99999/").status_code, 404)


class AdminUserUpdateTests(AdminApiTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.admin)

    def patch(self, user, data):
        return self.client.patch(f"/api/v1/admin/users/{user.pk}/", data, format="json")

    def test_change_role(self):
        response = self.patch(self.student, {"role": "moderator"})
        self.assertEqual(response.status_code, 200)
        self.student.refresh_from_db()
        self.assertEqual(self.student.role, User.Role.MODERATOR)

    def test_suspend_needs_a_reason_and_ends_the_session(self):
        Token.objects.create(user=self.student)

        missing = self.patch(self.student, {"status": "suspended"})
        self.assertEqual(missing.status_code, 400)
        self.assertIn("status_note", missing.json())

        response = self.patch(
            self.student, {"status": "suspended", "status_note": "Selling banned items."}
        )
        self.assertEqual(response.status_code, 200)
        self.student.refresh_from_db()
        self.assertEqual(self.student.status, User.Status.SUSPENDED)
        self.assertEqual(self.student.status_note, "Selling banned items.")
        self.assertIsNotNone(self.student.status_changed_at)
        self.assertFalse(Token.objects.filter(user=self.student).exists())

    def test_reactivate_does_not_need_a_reason(self):
        self.student.status = User.Status.BANNED
        self.student.is_active = False
        self.student.save()

        response = self.patch(self.student, {"status": "active"})
        self.assertEqual(response.status_code, 200)
        self.student.refresh_from_db()
        self.assertEqual(self.student.status, User.Status.ACTIVE)
        self.assertTrue(self.student.is_active)
        self.assertTrue(self.student.can_sign_in)

    def test_cannot_change_own_role_or_status(self):
        self.assertEqual(self.patch(self.admin, {"role": "user"}).status_code, 400)
        response = self.patch(self.admin, {"status": "suspended", "status_note": "test"})
        self.assertEqual(response.status_code, 400)

    def test_cannot_demote_the_only_administrator(self):
        self.admin2.role = User.Role.USER
        self.admin2.save()
        superuser = User.objects.create_superuser(
            "root@rtu.edu.ph", "Root", password=PASSWORD
        )
        superuser.role = User.Role.USER  # still a superuser, so the API lets them in
        superuser.save()
        self.client.force_authenticate(superuser)

        response = self.patch(self.admin, {"role": "user"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("role", response.json())

    def test_unverified_account_cannot_be_given_a_role(self):
        response = self.patch(self.pending, {"role": "moderator"})
        self.assertEqual(response.status_code, 400)

    def test_email_cannot_be_edited_here(self):
        self.patch(self.student, {"email": "someone@rtu.edu.ph", "role": "user"})
        self.student.refresh_from_db()
        self.assertEqual(self.student.email, "2024-000001@rtu.edu.ph")


class AdminVerifyTests(AdminApiTestCase):
    def test_office_staff_can_verify_an_account(self):
        self.client.force_authenticate(self.staff)
        response = self.client.post(f"/api/v1/admin/users/{self.pending.pk}/verify/")
        self.assertEqual(response.status_code, 200)
        self.pending.refresh_from_db()
        self.assertTrue(self.pending.is_verified)
        self.assertEqual(self.pending.role, User.Role.USER)

    def test_verify_twice_is_rejected(self):
        self.client.force_authenticate(self.staff)
        response = self.client.post(f"/api/v1/admin/users/{self.student.pk}/verify/")
        self.assertEqual(response.status_code, 400)

    def test_suspended_account_is_not_verified(self):
        self.pending.status = User.Status.SUSPENDED
        self.pending.save()
        self.client.force_authenticate(self.staff)
        response = self.client.post(f"/api/v1/admin/users/{self.pending.pk}/verify/")
        self.assertEqual(response.status_code, 400)

    def test_regular_user_cannot_verify(self):
        self.client.force_authenticate(self.student)
        response = self.client.post(f"/api/v1/admin/users/{self.pending.pk}/verify/")
        self.assertEqual(response.status_code, 403)


class AdminSummaryTests(AdminApiTestCase):
    def test_summary_counts(self):
        self.client.force_authenticate(self.admin)
        body = self.client.get("/api/v1/admin/summary/").json()

        self.assertEqual(body["total"], 6)
        self.assertEqual(body["unverified"], 1)
        self.assertEqual(body["new_last_7_days"], 6)
        self.assertEqual(body["by_role"]["administrator"], 2)
        self.assertEqual(body["by_role"]["moderator"], 1)
        self.assertEqual(body["by_status"], {"active": 6, "suspended": 0, "banned": 0})
        self.assertEqual(body["by_member_type"]["student"], 2)
        self.assertEqual(len(body["recent"]), 6)

    def test_moderator_gets_counts_without_names(self):
        self.client.force_authenticate(self.moderator)
        body = self.client.get("/api/v1/admin/summary/").json()

        self.assertEqual(body["total"], 6)
        self.assertEqual(body["recent"], [])
