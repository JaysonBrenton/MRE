# @fileoverview Registry parity tests — Python mirror must match TS registry fixture.

from __future__ import annotations

import json
from pathlib import Path

from ingestion.common.settings_registry import (
    INGESTION_SETTINGS_REGISTRY,
    get_setting_definition,
    list_admin_visible_settings,
    list_by_category,
    list_setting_keys,
    to_registry_parity_records,
)

FIXTURE_PATH = Path(__file__).resolve().parents[1] / "fixtures" / "settings_registry_parity.json"


def _load_parity_fixture() -> list[dict]:
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


class TestSettingsRegistry:
    def test_unique_keys(self):
        keys = list_setting_keys()
        assert len(set(keys)) == len(keys)

    def test_registry_length(self):
        assert len(INGESTION_SETTINGS_REGISTRY) == 47

    def test_get_setting_definition(self):
        assert get_setting_definition("MRE_SCRAPE_ENABLED") is not None
        assert get_setting_definition("MRE_SCRAPE_ENABLED").type == "boolean"
        assert get_setting_definition("NOT_A_SETTING") is None

    def test_writable_derived_from_apply_mode(self):
        runtime = get_setting_definition("MRE_SCRAPE_ENABLED")
        restart = get_setting_definition("SITE_POLICY_PATH")
        readonly = get_setting_definition("DATABASE_URL")

        assert runtime is not None and runtime.writable is True
        assert restart is not None and restart.writable is False
        assert readonly is not None and readonly.writable is False

    def test_list_by_category_covers_all_settings(self):
        grouped = list_by_category()
        keys_from_groups = [definition.key for group in grouped for definition in group.settings]
        assert keys_from_groups == list_setting_keys()

    def test_list_admin_visible_settings_excludes_admin_token(self):
        visible = list_admin_visible_settings()
        assert all(definition.key != "INGESTION_ADMIN_TOKEN" for definition in visible)
        assert len(visible) == len(INGESTION_SETTINGS_REGISTRY) - 1

    def test_matches_committed_parity_fixture(self):
        fixture = _load_parity_fixture()
        assert to_registry_parity_records() == fixture
