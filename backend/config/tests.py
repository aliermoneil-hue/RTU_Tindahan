from django.test import TestCase


class ProjectEndpointTests(TestCase):
    def test_api_root_lists_the_service(self):
        response = self.client.get("/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["service"], "RTU Tindahan API")
        self.assertIn("login", response.json()["endpoints"])

    def test_api_v1_root_matches_the_project_root(self):
        response = self.client.get("/api/v1/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["version"], "v1")

    def test_health_reports_the_database(self):
        response = self.client.get("/health/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")
        self.assertEqual(response.json()["database"], "ok")
