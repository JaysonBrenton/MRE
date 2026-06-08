# @fileoverview DB precedence tests for settings resolver

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from ingestion.common.settings import clear_settings_cache, get_effective


@pytest.fixture(autouse=True)
def _clear_cache():
    clear_settings_cache()
    yield
    clear_settings_cache()


class TestSettingsResolverDbPrecedence:
    def test_db_override_wins_over_environment(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setenv("MRE_RECENT_EVENTS_DAYS", "7")

        mock_row = MagicMock()
        mock_row.key = "MRE_RECENT_EVENTS_DAYS"
        mock_row.value = "21"

        mock_query = MagicMock()
        mock_query.all.return_value = [mock_row]
        mock_session = MagicMock()
        mock_session.query.return_value = mock_query

        with patch("ingestion.common.settings.SessionLocal", return_value=mock_session):
            setting = get_effective("MRE_RECENT_EVENTS_DAYS", mask_secrets=False)

        assert setting.effective_value == 21
        assert setting.source == "database"
        assert setting.db_value == 21
        assert setting.env_value == 7

    def test_clear_settings_cache_forces_reload(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.delenv("MRE_RECENT_EVENTS_DAYS", raising=False)

        first_row = MagicMock()
        first_row.key = "MRE_RECENT_EVENTS_DAYS"
        first_row.value = "10"
        second_row = MagicMock()
        second_row.key = "MRE_RECENT_EVENTS_DAYS"
        second_row.value = "12"

        mock_query = MagicMock()
        mock_query.all.side_effect = [[first_row], [second_row]]
        mock_session = MagicMock()
        mock_session.query.return_value = mock_query

        with patch("ingestion.common.settings.SessionLocal", return_value=mock_session):
            assert get_effective("MRE_RECENT_EVENTS_DAYS", mask_secrets=False).effective_value == 10
            clear_settings_cache()
            assert get_effective("MRE_RECENT_EVENTS_DAYS", mask_secrets=False).effective_value == 12
