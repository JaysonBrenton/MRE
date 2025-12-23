"""Metrics helpers for LiveRC ingestion."""

from __future__ import annotations

import time
from typing import Optional

from prometheus_client import CollectorRegistry, Counter, Histogram

# Dedicated registry so the service can expose metrics endpoint later.
REGISTRY = CollectorRegistry()

_INGESTION_DURATION = Histogram(
    "ingestion_duration_seconds",
    "Time spent ingesting a single event",
    labelnames=("event_id", "track_id", "result"),
    registry=REGISTRY,
)

_RACE_FETCH_DURATION = Histogram(
    "race_fetch_duration_seconds",
    "Latency for fetching a race page",
    labelnames=("event_id", "race_id", "method"),
    registry=REGISTRY,
)

_LAP_EXTRACTION_DURATION = Histogram(
    "lap_extraction_duration_seconds",
    "Latency for parsing lap tables",
    labelnames=("event_id", "race_id"),
    registry=REGISTRY,
)

_DB_ROWS_INSERTED = Counter(
    "db_rows_inserted_total",
    "Total inserted rows per table",
    labelnames=("table_name",),
    registry=REGISTRY,
)

_DB_ROWS_UPDATED = Counter(
    "db_rows_updated_total",
    "Total updated rows per table",
    labelnames=("table_name",),
    registry=REGISTRY,
)

_CONNECTOR_ERRORS = Counter(
    "connector_errors_total",
    "Total connector errors grouped by stage and error code",
    labelnames=("stage", "error_code"),
    registry=REGISTRY,
)


def record_db_insert(table: str, count: int = 1) -> None:
    """Increment the DB insert counter."""
    if count > 0:
        _DB_ROWS_INSERTED.labels(table_name=table).inc(count)


def record_db_update(table: str, count: int = 1) -> None:
    """Increment the DB update counter."""
    if count > 0:
        _DB_ROWS_UPDATED.labels(table_name=table).inc(count)


def record_connector_error(stage: str, error_code: str) -> None:
    """Record a connector error for monitoring."""
    _CONNECTOR_ERRORS.labels(stage=stage, error_code=error_code).inc()


class _DurationTracker:
    """Helper that records elapsed time when finished."""

    def __init__(self, histogram: Histogram, labels: dict[str, str]):
        self._histogram = histogram
        self._labels = labels
        self._start = time.perf_counter()

    def observe(self) -> None:
        elapsed = time.perf_counter() - self._start
        self._histogram.labels(**self._labels).observe(elapsed)


class IngestionDurationTracker:
    """Tracks total ingestion time for one event."""

    def __init__(self, event_id: str, track_id: str):
        self._event_id = event_id
        self._track_id = track_id
        self._start = time.perf_counter()

    def finish(self, result: str) -> None:
        elapsed = time.perf_counter() - self._start
        _INGESTION_DURATION.labels(
            event_id=self._event_id,
            track_id=self._track_id,
            result=result,
        ).observe(elapsed)


def start_race_fetch_timer(event_id: str, race_id: str, method: str) -> _DurationTracker:
    """Start a race fetch timer."""
    return _DurationTracker(
        _RACE_FETCH_DURATION,
        {"event_id": event_id, "race_id": race_id, "method": method},
    )


def start_lap_extraction_timer(event_id: str, race_id: str) -> _DurationTracker:
    """Start a lap extraction timer."""
    return _DurationTracker(
        _LAP_EXTRACTION_DURATION,
        {"event_id": event_id, "race_id": race_id},
    )


def observe_race_fetch(event_id: str, race_id: str, method: str, duration_seconds: float) -> None:
    """Record race fetch duration from arbitrary timer."""
    _RACE_FETCH_DURATION.labels(
        event_id=event_id,
        race_id=race_id,
        method=method,
    ).observe(duration_seconds)


def observe_lap_extraction(event_id: str, race_id: str, duration_seconds: float) -> None:
    """Record lap extraction duration from arbitrary timer."""
    _LAP_EXTRACTION_DURATION.labels(
        event_id=event_id,
        race_id=race_id,
    ).observe(duration_seconds)


__all__ = [
    "IngestionDurationTracker",
    "record_db_insert",
    "record_db_update",
    "record_connector_error",
    "start_race_fetch_timer",
    "start_lap_extraction_timer",
    "observe_race_fetch",
    "observe_lap_extraction",
    "REGISTRY",
]
