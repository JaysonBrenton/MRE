# @fileoverview Unit tests for admin settings API token auth and GET /api/v1/admin/settings

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from ingestion.api.app import app

TEST_TOKEN = "test-ingestion-admin-token"


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("INGESTION_ADMIN_TOKEN", TEST_TOKEN)
    return TestClient(app)


class TestAdminSettingsApi:
    def test_get_settings_missing_token_returns_401(self, client: TestClient):
        response = client.get("/api/v1/admin/settings")
        assert response.status_code == 401

    def test_get_settings_invalid_token_returns_401(self, client: TestClient):
        response = client.get(
            "/api/v1/admin/settings",
            headers={"X-Ingestion-Admin-Token": "wrong-token"},
        )
        assert response.status_code == 401

    def test_get_settings_unconfigured_token_returns_401(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.delenv("INGESTION_ADMIN_TOKEN", raising=False)
        client = TestClient(app)
        response = client.get(
            "/api/v1/admin/settings",
            headers={"X-Ingestion-Admin-Token": TEST_TOKEN},
        )
        assert response.status_code == 401

    def test_get_settings_valid_token_returns_registry(self, client: TestClient):
        response = client.get(
            "/api/v1/admin/settings",
            headers={"X-Ingestion-Admin-Token": TEST_TOKEN},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        settings = body["data"]["settings"]
        categories = body["data"]["categories"]
        assert len(settings) == 44
        assert all(item["key"] != "INGESTION_ADMIN_TOKEN" for item in settings)
        assert all(item["key"] not in {"INGESTION_SERVICE_URL", "INGESTION_PORT"} for item in settings)
        assert any(item["key"] == "MRE_SCRAPE_ENABLED" for item in settings)
        assert len(categories) >= 8
        scrape = next(item for item in settings if item["key"] == "MRE_SCRAPE_ENABLED")
        assert scrape["applyMode"] == "runtime"
        assert "effectiveValue" in scrape
        assert scrape["source"] in {"environment", "default"}
