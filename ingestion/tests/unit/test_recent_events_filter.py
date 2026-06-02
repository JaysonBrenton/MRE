"""Unit tests for recent events auto-ingest filter logic."""

from datetime import date, datetime, timezone
from uuid import uuid4

import pytest

from ingestion.db.models import Event, IngestDepth
from ingestion.ingestion.recent_events import (
    RecentEventsFilterConfig,
    apply_ingest_caps,
    build_recent_ingest_candidates,
    event_meets_min_age,
    event_overlaps_window,
    is_eligible_for_auto_ingest,
    window_start,
)


def _config(
    *,
    days: int = 7,
    min_event_age_hours: int = 12,
    run_at: datetime | None = None,
) -> RecentEventsFilterConfig:
    return RecentEventsFilterConfig(
        days=days,
        min_event_age_hours=min_event_age_hours,
        run_at_utc=run_at or datetime(2026, 5, 31, 14, 0, 0, tzinfo=timezone.utc),
    )


def test_window_inclusive_seven_days():
    config = _config(run_at=datetime(2026, 5, 31, 12, 0, tzinfo=timezone.utc))
    assert window_start(config) == date(2026, 5, 25)
    assert event_overlaps_window(date(2026, 5, 25), None, config) is True
    assert event_overlaps_window(date(2026, 5, 24), None, config) is False


def test_outside_window():
    config = _config()
    assert event_overlaps_window(date(2026, 5, 23), None, config) is False


def test_future_event_excluded():
    config = _config()
    assert event_overlaps_window(date(2026, 6, 1), None, config) is False


def test_multi_day_overlap():
    config = _config()
    assert event_overlaps_window(
        date(2026, 5, 22),
        date(2026, 5, 25),
        config,
    ) is True


def test_min_age_same_day_event():
    config = _config(
        min_event_age_hours=12,
        run_at=datetime(2026, 5, 31, 6, 0, 0, tzinfo=timezone.utc),
    )
    assert event_meets_min_age(date(2026, 5, 31), config) is False


def test_min_age_old_enough():
    config = _config(
        min_event_age_hours=12,
        run_at=datetime(2026, 5, 31, 14, 0, 0, tzinfo=timezone.utc),
    )
    assert event_meets_min_age(date(2026, 5, 30), config) is True


def test_eligible_new_none_depth():
    assert is_eligible_for_auto_ingest(
        ingest_depth=IngestDepth.NONE,
        re_ingest_stale=False,
        overlaps_window=True,
        meets_min_age=True,
    )


def test_skip_complete_without_reingest():
    assert is_eligible_for_auto_ingest(
        ingest_depth=IngestDepth.LAPS_FULL,
        re_ingest_stale=False,
        overlaps_window=True,
        meets_min_age=True,
    ) is False


def test_stale_reingest_flag():
    assert is_eligible_for_auto_ingest(
        ingest_depth=IngestDepth.LAPS_FULL,
        re_ingest_stale=True,
        overlaps_window=True,
        meets_min_age=True,
    )


def _event(event_date: date, depth: IngestDepth = IngestDepth.NONE) -> Event:
    return Event(
        id=str(uuid4()),
        source="liverc",
        source_event_id="123",
        track_id=str(uuid4()),
        event_name="Test Event",
        event_date=datetime.combine(event_date, datetime.min.time(), tzinfo=timezone.utc),
        event_entries=10,
        event_drivers=8,
        event_url="https://example.liverc.com/",
        ingest_depth=depth,
    )


def test_build_candidates_includes_none_depth_in_window():
    config = _config()
    events = [_event(date(2026, 5, 30), IngestDepth.NONE)]
    result = build_recent_ingest_candidates(events, config, re_ingest_stale=False)
    assert len(result.candidates) == 1
    assert result.events_eligible == 1


def test_build_candidates_skips_laps_full():
    config = _config()
    events = [_event(date(2026, 5, 30), IngestDepth.LAPS_FULL)]
    result = build_recent_ingest_candidates(events, config, re_ingest_stale=False)
    assert result.candidates == []
    assert result.events_skipped_already_full == 1


def test_apply_ingest_caps():
    events = [_event(date(2026, 5, 30)) for _ in range(5)]
    selected, skipped = apply_ingest_caps(
        events,
        max_ingests_remaining=10,
        max_per_track=2,
    )
    assert len(selected) == 2
    assert skipped == 3


def test_apply_ingest_caps_global_exhausted():
    events = [_event(date(2026, 5, 30))]
    selected, skipped = apply_ingest_caps(
        events,
        max_ingests_remaining=0,
        max_per_track=5,
    )
    assert selected == []
    assert skipped == 1
