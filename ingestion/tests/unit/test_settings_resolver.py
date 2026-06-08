# @fileoverview Unit tests for ingestion settings resolver.

from __future__ import annotations

import pytest

from ingestion.common.settings import get_bool, get_effective, get_int, list_all, list_ingestion_scoped
from ingestion.common.settings_registry import list_setting_keys


class TestSettingsResolver:
    def test_get_effective_unknown_key_raises(self):
        with pytest.raises(KeyError, match="Unknown ingestion setting key"):
            get_effective("NOT_A_SETTING", mask_secrets=False)

    def test_get_effective_uses_registry_default_when_env_unset(self, monkeypatch):
        monkeypatch.delenv("MRE_RECENT_EVENTS_DAYS", raising=False)
        setting = get_effective("MRE_RECENT_EVENTS_DAYS", mask_secrets=False)
        assert setting.effective_value == 7
        assert setting.source == "default"
        assert setting.env_value is None
        assert setting.default_value == 7

    def test_get_effective_uses_environment_when_set(self, monkeypatch):
        monkeypatch.setenv("MRE_RECENT_EVENTS_DAYS", "14")
        setting = get_effective("MRE_RECENT_EVENTS_DAYS", mask_secrets=False)
        assert setting.effective_value == 14
        assert setting.source == "environment"
        assert setting.env_value == 14

    def test_get_effective_parses_boolean_env(self, monkeypatch):
        monkeypatch.setenv("MRE_SCRAPE_ENABLED", "false")
        setting = get_effective("MRE_SCRAPE_ENABLED", mask_secrets=False)
        assert setting.effective_value is False
        assert setting.source == "environment"

    def test_runtime_code_constants_use_environment(self, monkeypatch):
        monkeypatch.setenv("RACE_FETCH_CONCURRENCY", "12")
        setting = get_effective("RACE_FETCH_CONCURRENCY", mask_secrets=False)
        assert setting.effective_value == 12
        assert setting.source == "environment"
        assert setting.env_value == 12

    def test_masks_database_url_by_default(self, monkeypatch):
        monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@host/db")
        monkeypatch.setattr(
            "ingestion.common.settings._load_db_overrides",
            lambda force=False: {},
        )
        from ingestion.common.settings import clear_settings_cache

        clear_settings_cache()
        setting = get_effective("DATABASE_URL")
        assert setting.effective_value == "postgresql://***"

    def test_list_all_covers_registry(self):
        assert len(list_all(mask_secrets=False)) == len(list_setting_keys())

    def test_list_ingestion_scoped_excludes_app_only_keys(self):
        keys = {setting.key for setting in list_ingestion_scoped(mask_secrets=False)}
        assert "INGESTION_SERVICE_URL" not in keys
        assert "INGESTION_PORT" not in keys
        assert "MRE_SCRAPE_ENABLED" in keys

    def test_typed_helpers(self, monkeypatch):
        monkeypatch.setenv("INGESTION_QUEUE_MAX_CONCURRENT", "4")
        monkeypatch.setenv("MRE_SCRAPE_ENABLED", "true")
        assert get_int("INGESTION_QUEUE_MAX_CONCURRENT") == 4
        assert get_bool("MRE_SCRAPE_ENABLED") is True
