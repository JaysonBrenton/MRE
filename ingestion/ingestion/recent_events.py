"""Date-window and eligibility filtering for recent events auto-ingest."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

from ingestion.db.models import Event, IngestDepth


@dataclass(frozen=True)
class RecentEventsFilterConfig:
    """Configuration for recency window and minimum event age checks."""

    days: int
    min_event_age_hours: int
    run_at_utc: datetime


@dataclass
class RecentIngestCandidateResult:
    """Eligible events and skip counters for one track."""

    candidates: list[Event]
    events_in_window: int
    events_eligible: int
    events_skipped_age: int
    events_skipped_already_full: int


def _to_date(value: date | datetime) -> date:
    if isinstance(value, datetime):
        if value.tzinfo is not None:
            return value.astimezone(timezone.utc).date()
        return value.date()
    return value


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def window_start(config: RecentEventsFilterConfig) -> date:
    """Inclusive start date of the recency window."""
    return config.run_at_utc.date() - timedelta(days=config.days - 1)


def window_end(config: RecentEventsFilterConfig) -> date:
    """Inclusive end date of the recency window (run date)."""
    return config.run_at_utc.date()


def event_overlaps_window(
    event_date: date | datetime,
    event_date_end: date | datetime | None,
    config: RecentEventsFilterConfig,
) -> bool:
    """Return True when the event date (or range) intersects the recency window."""
    start = window_start(config)
    end = window_end(config)
    ev_start = _to_date(event_date)
    ev_end = _to_date(event_date_end) if event_date_end is not None else ev_start

    if ev_start > end:
        return False

    range_start = min(ev_start, ev_end)
    range_end = max(ev_start, ev_end)
    return range_start <= end and range_end >= start


def event_meets_min_age(
    event_date: date | datetime,
    config: RecentEventsFilterConfig,
) -> bool:
    """Return True when the event is at least min_event_age_hours old (UTC midnight basis)."""
    ev_date = _to_date(event_date)
    event_midnight = datetime.combine(ev_date, datetime.min.time(), tzinfo=timezone.utc)
    run_at = _as_utc(config.run_at_utc)
    age_hours = (run_at - event_midnight).total_seconds() / 3600
    return age_hours >= config.min_event_age_hours


def is_eligible_for_auto_ingest(
    *,
    ingest_depth: IngestDepth,
    re_ingest_stale: bool,
    overlaps_window: bool,
    meets_min_age: bool,
) -> bool:
    """Return True when an event should receive laps_full auto-ingest."""
    if not overlaps_window or not meets_min_age:
        return False
    if ingest_depth == IngestDepth.LAPS_FULL:
        return re_ingest_stale
    return True


def build_recent_ingest_candidates(
    events: list[Event],
    config: RecentEventsFilterConfig,
    re_ingest_stale: bool,
) -> RecentIngestCandidateResult:
    in_window = 0
    skipped_age = 0
    skipped_already_full = 0
    candidates: list[Event] = []

    for event in events:
        overlaps = event_overlaps_window(
            event.event_date,
            event.event_date_end,
            config,
        )
        if not overlaps:
            continue

        in_window += 1
        meets_age = event_meets_min_age(event.event_date, config)

        if not meets_age:
            skipped_age += 1
            continue

        if event.ingest_depth == IngestDepth.LAPS_FULL and not re_ingest_stale:
            skipped_already_full += 1
            continue

        candidates.append(event)

    candidates.sort(
        key=lambda e: _as_utc(e.event_date) if isinstance(e.event_date, datetime) else e.event_date,
        reverse=True,
    )

    return RecentIngestCandidateResult(
        candidates=candidates,
        events_in_window=in_window,
        events_eligible=len(candidates),
        events_skipped_age=skipped_age,
        events_skipped_already_full=skipped_already_full,
    )


def apply_ingest_caps(
    candidates: list[Event],
    *,
    max_ingests_remaining: int,
    max_per_track: int,
) -> tuple[list[Event], int]:
    """
    Trim candidates by per-track and global caps.

    Returns (selected, skipped_by_cap_count).
    """
    if max_ingests_remaining <= 0 or max_per_track <= 0:
        return [], len(candidates)

    per_track_limit = min(max_per_track, max_ingests_remaining)
    selected = candidates[:per_track_limit]
    skipped = len(candidates) - len(selected)
    return selected, skipped
