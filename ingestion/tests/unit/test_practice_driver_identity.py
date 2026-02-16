# Unit tests for practice driver identity helper (practice day full ingestion).

import pytest

from ingestion.ingestion.practice_driver_identity import get_practice_source_driver_id


class TestGetPracticeSourceDriverId:
    """Tests for get_practice_source_driver_id."""

    def test_transponder_present_returns_transponder(self):
        assert get_practice_source_driver_id("session-123", "456") == "456"

    def test_transponder_none_returns_synthetic(self):
        assert get_practice_source_driver_id("session-123", None) == "practice_session_session-123"

    def test_transponder_empty_string_returns_synthetic(self):
        assert get_practice_source_driver_id("session-123", "") == "practice_session_session-123"

    def test_transponder_whitespace_only_returns_synthetic(self):
        assert get_practice_source_driver_id("session-123", "   ") == "practice_session_session-123"

    def test_unknown_driver_with_transponder_returns_transponder(self):
        # "Unknown Driver" is display name only; transponder still identifies the session
        assert get_practice_source_driver_id("21290331", "123") == "123"

    def test_session_id_preserved_in_synthetic(self):
        sid = "abc-def_99"
        assert get_practice_source_driver_id(sid, None) == f"practice_session_{sid}"
