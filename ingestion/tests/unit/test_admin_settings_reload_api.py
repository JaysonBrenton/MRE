# @fileoverview Admin settings reload endpoint tests

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from ingestion.api.app import app

TEST_TOKEN = "test-ingestion-admin-token"


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("INGESTION_ADMIN_TOKEN", TEST_TOKEN)
    return TestClient(app)


class TestAdminSettingsReloadApi:
    def test_reload_requires_token(self, client: TestClient):
        response = client.post("/api/v1/admin/settings/reload")
        assert response.status_code == 401

    def test_reload_clears_cache(self, client: TestClient):
        response = client.post(
            "/api/v1/admin/settings/reload",
            headers={"X-Ingestion-Admin-Token": TEST_TOKEN},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        assert "reloadedAt" in body["data"]
