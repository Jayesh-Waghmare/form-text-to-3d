import sys
from pathlib import Path
import unittest
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
import backend


class BackendTests(unittest.TestCase):
    def setUp(self):
        backend.jobs.clear()
        self.client = TestClient(backend.app)

    def test_serves_viewer_and_health(self):
        self.assertEqual(self.client.get("/").status_code, 200)
        self.assertEqual(self.client.get("/api/health").json()["service"], "form-shap-e")

    def test_rejects_invalid_prompts_and_quality(self):
        for data in ({"prompt": " "}, {"prompt": "x" * 801}, {"prompt": "A chair", "quality": "ultra"}):
            self.assertEqual(self.client.post("/api/jobs", json=data).status_code, 422)

    @patch.object(backend.executor, "submit")
    def test_limits_queue_and_allows_cancellation(self, submit):
        ids = [self.client.post("/api/jobs", json={"prompt": "A chair"}).json()["id"] for _ in range(3)]
        self.assertEqual(self.client.post("/api/jobs", json={"prompt": "A chair"}).status_code, 429)
        self.assertEqual(self.client.delete("/api/jobs/" + ids[0]).status_code, 202)
        self.assertTrue(self.client.get("/api/jobs/" + ids[0]).json()["cancelled"])
        self.assertEqual(submit.call_count, 3)

    def test_unknown_models_and_traversal_are_not_downloadable(self):
        for url in ("/api/models/unknown.glb", "/api/models/%2E%2E%2Fbackend.py"):
            self.assertEqual(self.client.get(url).status_code, 404)


if __name__ == "__main__":
    unittest.main()
