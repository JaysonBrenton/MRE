"""Tests for LiveRC Time Completed − Length → derived session start."""

from datetime import datetime, timedelta

from ingestion.common.liverc_race_times import derive_race_start_from_liverc
from ingestion.connectors.liverc.models import ConnectorRaceSummary
from ingestion.ingestion.normalizer import Normalizer


def test_derive_race_start_from_liverc():
    completed = datetime(2026, 3, 8, 16, 18, 0)
    assert derive_race_start_from_liverc(completed, 3600) == completed - timedelta(seconds=3600)
    assert derive_race_start_from_liverc(completed, None) is None
    assert derive_race_start_from_liverc(None, 60) is None


def test_normalize_race_derives_start_from_time_completed_and_duration():
    race = ConnectorRaceSummary(
        source_race_id="1",
        race_full_label="Race 1",
        class_name="Buggy",
        race_label="Buggy A",
        race_order=1,
        race_url="https://x.example/r/1",
        time_completed=datetime(2026, 3, 8, 16, 18, 0),
        duration_seconds=3600,
    )
    out = Normalizer.normalize_race(race)
    assert out["completed_at"] == race.time_completed
    assert out["start_time"] == datetime(2026, 3, 8, 15, 18, 0)
    assert out["duration_seconds"] == 3600
