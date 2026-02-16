"""Integration tests for practice day full ingestion (list + detail + laps)."""

from __future__ import annotations

import os
from datetime import date, datetime
from unittest.mock import AsyncMock
from uuid import UUID, uuid4

import pytest

from ingestion.connectors.liverc.models import (
    PracticeDaySummary,
    PracticeSessionDetail,
    PracticeSessionSummary,
)
from ingestion.db.session import db_session
from ingestion.db.repository import Repository
from ingestion.ingestion.pipeline import IngestionPipeline


def _make_session_summary(
    session_id: str,
    driver_name: str,
    class_name: str = "1/8 Buggy",
    transponder_number: str | None = "123",
    lap_count: int = 10,
    fastest_lap: float | None = 45.5,
    average_lap: float | None = 48.2,
) -> PracticeSessionSummary:
    return PracticeSessionSummary(
        session_id=session_id,
        driver_name=driver_name,
        class_name=class_name,
        transponder_number=transponder_number,
        start_time=datetime(2025, 10, 25, 9, 0, 0),
        duration_seconds=600,
        lap_count=lap_count,
        fastest_lap=fastest_lap,
        average_lap=average_lap,
        session_url=f"https://track.liverc.com/practice/?p=view_session&id={session_id}",
    )


def _make_session_detail(
    session_id: str,
    lap_count: int = 10,
    laps: list | None = None,
) -> PracticeSessionDetail:
    return PracticeSessionDetail(
        session_id=session_id,
        driver_name="Test Driver",
        class_name="1/8 Buggy",
        transponder_number="123",
        date=date(2025, 10, 25),
        start_time=datetime(2025, 10, 25, 9, 0, 0),
        end_time=datetime(2025, 10, 25, 9, 10, 0),
        duration_seconds=600,
        lap_count=lap_count,
        fastest_lap=45.5,
        average_lap=48.2,
        consistency=95.0,
        laps=laps or [],
    )


@pytest.mark.asyncio
@pytest.mark.skipif(
    not os.environ.get("DATABASE_URL") or "sqlite" in os.environ.get("DATABASE_URL", ""),
    reason="Practice day full ingestion integration test requires Postgres (run in Docker)",
)
async def test_practice_day_full_ingestion_list_phase_creates_event_races_drivers_results():
    """Full ingest_practice_day with mocked connector: assert Event, Races, Drivers, RaceDrivers, RaceResults."""
    with db_session() as session:
        repo = Repository(session)
        track = repo.upsert_track(
            source="liverc",
            source_track_slug="testtrack-practice-full",
            track_name="Test Track",
            track_url="https://testtrack.liverc.com/",
            events_url="https://testtrack.liverc.com/events",
        )
        session.flush()
        track_uuid = UUID(str(track.id))
        session.commit()

    practice_date = date(2025, 10, 25)
    sessions = [
        _make_session_summary("sess-1", "Driver One", transponder_number="111", lap_count=5),
        _make_session_summary("sess-2", "Unknown Driver", transponder_number="222", lap_count=3),
    ]
    overview = PracticeDaySummary(
        date=practice_date,
        track_slug="testtrack-practice-full",
        session_count=2,
        total_laps=8,
        total_track_time_seconds=400,
        unique_drivers=2,
        unique_classes=1,
        sessions=sessions,
    )
    detail_sess1 = _make_session_detail("sess-1", lap_count=5, laps=[])
    detail_sess2 = _make_session_detail("sess-2", lap_count=3, laps=[])

    pipeline = IngestionPipeline()
    pipeline.connector.fetch_practice_day_overview = AsyncMock(return_value=overview)
    pipeline._fetch_practice_session_details_with_concurrency = AsyncMock(
        return_value=[
            (sessions[0], detail_sess1, None),
            (sessions[1], detail_sess2, None),
        ],
    )

    result = await pipeline.ingest_practice_day(
        track_id=track_uuid,
        practice_date=practice_date,
    )

    assert result["status"] == "completed"
    assert result["sessions_ingested"] == 2
    assert result["sessions_failed"] == 0
    assert "event_id" in result

    with db_session() as session:
        from sqlalchemy import select, func
        from ingestion.db.models import Event, Race, Driver, RaceDriver, RaceResult

        event_id = result["event_id"]
        event = session.get(Event, event_id)
        assert event is not None
        races = list(session.scalars(select(Race).where(Race.event_id == event_id)))
        assert len(races) == 2
        for r in races:
            assert r.class_name is not None, "Race.class_name (driver class) must be set from LiveRC"
        race_drivers = list(session.scalars(select(RaceDriver).where(RaceDriver.race_id.in_(r.id for r in races))))
        assert len(race_drivers) == 2
        results = list(session.scalars(select(RaceResult).where(RaceResult.race_id.in_(r.id for r in races))))
        assert len(results) == 2
        for res in results:
            assert res.position_final == 1
            assert res.laps_completed is not None
        drivers_count = session.scalar(select(func.count(Driver.id)).where(Driver.source == "liverc"))
        assert drivers_count >= 2
        # Detail phase: at least one race should have race_metadata (practiceSessionStats)
        races_with_metadata = [r for r in races if r.race_metadata is not None]
        assert len(races_with_metadata) >= 1, "Detail phase should set race_metadata"
        # At least one result should have consistency/raw_fields_json from detail
        results_with_raw = [r for r in results if r.raw_fields_json is not None]
        assert len(results_with_raw) >= 1, "Detail phase should set RaceResult.raw_fields_json"


def _create_track_for_test(slug_suffix: str) -> UUID:
    """Create a track in DB and return its id for use in ingest_practice_day."""
    with db_session() as session:
        repo = Repository(session)
        track = repo.upsert_track(
            source="liverc",
            source_track_slug=f"testtrack-practice-{slug_suffix}",
            track_name="Test Track",
            track_url="https://testtrack.liverc.com/",
            events_url="https://testtrack.liverc.com/events",
        )
        session.flush()
        tid = UUID(str(track.id))
        session.commit()
    return tid


@pytest.mark.asyncio
@pytest.mark.skipif(
    not os.environ.get("DATABASE_URL") or "sqlite" in os.environ.get("DATABASE_URL", ""),
    reason="Practice day full ingestion integration test requires Postgres (run in Docker)",
)
async def test_practice_day_full_ingestion_idempotency():
    """Import same day twice; no duplicate drivers/race_drivers/race_results, counts stable."""
    track_uuid = _create_track_for_test("idempotency")
    practice_date = date(2025, 10, 26)
    sessions = [
        _make_session_summary("sess-a", "Driver A", transponder_number="AAA"),
        _make_session_summary("sess-b", "Driver B", transponder_number="BBB"),
    ]
    overview = PracticeDaySummary(
        date=practice_date,
        track_slug="testtrack-practice-idempotency",
        session_count=2,
        total_laps=10,
        total_track_time_seconds=500,
        unique_drivers=2,
        unique_classes=1,
        sessions=sessions,
    )
    detail_a = _make_session_detail("sess-a")
    detail_b = _make_session_detail("sess-b")

    pipeline = IngestionPipeline()
    pipeline.connector.fetch_practice_day_overview = AsyncMock(return_value=overview)
    pipeline._fetch_practice_session_details_with_concurrency = AsyncMock(
        return_value=[
            (sessions[0], detail_a, None),
            (sessions[1], detail_b, None),
        ],
    )

    result1 = await pipeline.ingest_practice_day(track_id=track_uuid, practice_date=practice_date)
    result2 = await pipeline.ingest_practice_day(track_id=track_uuid, practice_date=practice_date)

    assert result1["status"] == "completed"
    assert result2["status"] == "completed"
    assert result1["event_id"] == result2["event_id"]
    assert result1["sessions_ingested"] == result2["sessions_ingested"] == 2

    with db_session() as session:
        from sqlalchemy import select, func
        from ingestion.db.models import Event, Race, RaceDriver, RaceResult, Driver

        event_id = result1["event_id"]
        races = list(session.scalars(select(Race).where(Race.event_id == event_id)))
        assert len(races) == 2
        race_ids = [r.id for r in races]
        rd_count = session.scalar(select(func.count(RaceDriver.id)).where(RaceDriver.race_id.in_(race_ids)))
        rr_count = session.scalar(select(func.count(RaceResult.id)).where(RaceResult.race_id.in_(race_ids)))
        assert rd_count == 2
        assert rr_count == 2
        drivers_for_track = session.scalar(
            select(func.count(Driver.id)).where(Driver.source == "liverc")
        )
        assert drivers_for_track >= 2


@pytest.mark.asyncio
@pytest.mark.skipif(
    not os.environ.get("DATABASE_URL") or "sqlite" in os.environ.get("DATABASE_URL", ""),
    reason="Practice day full ingestion integration test requires Postgres (run in Docker)",
)
async def test_practice_day_full_ingestion_partial_detail_failure():
    """One session's detail fetch fails; import completes, sessions_detail_failed=1, list-phase data present."""
    track_uuid = _create_track_for_test("partialfail")
    practice_date = date(2025, 10, 27)
    sessions = [
        _make_session_summary("s1", "Driver 1", transponder_number="1"),
        _make_session_summary("s2", "Driver 2", transponder_number="2"),
    ]
    overview = PracticeDaySummary(
        date=practice_date,
        track_slug="testtrack-practice-partialfail",
        session_count=2,
        total_laps=6,
        total_track_time_seconds=300,
        unique_drivers=2,
        unique_classes=1,
        sessions=sessions,
    )
    detail_s1 = _make_session_detail("s1", laps=[])
    # s2 detail fails (None, error)
    pipeline = IngestionPipeline()
    pipeline.connector.fetch_practice_day_overview = AsyncMock(return_value=overview)
    pipeline._fetch_practice_session_details_with_concurrency = AsyncMock(
        return_value=[
            (sessions[0], detail_s1, None),
            (sessions[1], None, Exception("detail fetch failed")),
        ],
    )

    result = await pipeline.ingest_practice_day(track_id=track_uuid, practice_date=practice_date)

    assert result["status"] == "completed"
    assert result["sessions_ingested"] == 2
    assert result["sessions_detail_failed"] == 1

    with db_session() as session:
        from sqlalchemy import select
        from ingestion.db.models import Event, Race, RaceDriver, RaceResult

        event_id = result["event_id"]
        races = list(session.scalars(select(Race).where(Race.event_id == event_id)))
        assert len(races) == 2
        race_drivers = list(session.scalars(select(RaceDriver).where(RaceDriver.race_id.in_(r.id for r in races))))
        assert len(race_drivers) == 2
        results = list(session.scalars(select(RaceResult).where(RaceResult.race_id.in_(r.id for r in races))))
        assert len(results) == 2


@pytest.mark.asyncio
@pytest.mark.skipif(
    not os.environ.get("DATABASE_URL") or "sqlite" in os.environ.get("DATABASE_URL", ""),
    reason="Practice day full ingestion integration test requires Postgres (run in Docker)",
)
async def test_practice_day_full_ingestion_no_transponder():
    """One session with transponder_number None: driver gets practice_session_{id}, detail runs but laps=0."""
    track_uuid = _create_track_for_test("notransponder")
    practice_date = date(2025, 10, 28)
    sessions = [
        _make_session_summary("with-trans", "Driver With", transponder_number="999"),
        _make_session_summary("no-trans", "Driver No Trans", transponder_number=None),
    ]
    overview = PracticeDaySummary(
        date=practice_date,
        track_slug="testtrack-practice-notransponder",
        session_count=2,
        total_laps=5,
        total_track_time_seconds=250,
        unique_drivers=2,
        unique_classes=1,
        sessions=sessions,
    )
    detail_with = _make_session_detail("with-trans", laps=[])
    detail_no = _make_session_detail("no-trans", laps=[])

    pipeline = IngestionPipeline()
    pipeline.connector.fetch_practice_day_overview = AsyncMock(return_value=overview)
    pipeline._fetch_practice_session_details_with_concurrency = AsyncMock(
        return_value=[
            (sessions[0], detail_with, None),
            (sessions[1], detail_no, None),
        ],
    )

    result = await pipeline.ingest_practice_day(track_id=track_uuid, practice_date=practice_date)

    assert result["status"] == "completed"
    assert result["sessions_ingested"] == 2

    with db_session() as session:
        from sqlalchemy import select
        from ingestion.db.models import Driver, Race, RaceDriver

        event_id = result["event_id"]
        races = list(session.scalars(select(Race).where(Race.event_id == event_id)))
        assert len(races) == 2
        race_drivers = list(session.scalars(select(RaceDriver).where(RaceDriver.race_id.in_(r.id for r in races))))
        assert len(race_drivers) == 2
        # Driver for no-transponder session should have source_driver_id = practice_session_no-trans
        drivers = list(session.scalars(select(Driver).where(Driver.source == "liverc")))
        source_ids = {d.source_driver_id for d in drivers}
        assert "practice_session_no-trans" in source_ids
        assert "999" in source_ids


@pytest.mark.asyncio
@pytest.mark.skipif(
    not os.environ.get("DATABASE_URL") or "sqlite" in os.environ.get("DATABASE_URL", ""),
    reason="Practice day full ingestion integration test requires Postgres (run in Docker)",
)
async def test_practice_day_full_ingestion_empty_sessions():
    """Practice day with 0 sessions: Event created, 0 Races, no drivers/results/laps, no error."""
    track_uuid = _create_track_for_test("empty")
    practice_date = date(2025, 10, 29)
    overview = PracticeDaySummary(
        date=practice_date,
        track_slug="testtrack-practice-empty",
        session_count=0,
        total_laps=0,
        total_track_time_seconds=0,
        unique_drivers=0,
        unique_classes=0,
        sessions=[],
    )

    pipeline = IngestionPipeline()
    pipeline.connector.fetch_practice_day_overview = AsyncMock(return_value=overview)
    pipeline._fetch_practice_session_details_with_concurrency = AsyncMock(return_value=[])

    result = await pipeline.ingest_practice_day(track_id=track_uuid, practice_date=practice_date)

    assert result["status"] == "completed"
    assert result["sessions_ingested"] == 0
    assert "event_id" in result

    with db_session() as session:
        from sqlalchemy import select
        from ingestion.db.models import Event, Race, RaceDriver, RaceResult

        event_id = result["event_id"]
        event = session.get(Event, event_id)
        assert event is not None
        races = list(session.scalars(select(Race).where(Race.event_id == event_id)))
        assert len(races) == 0
        race_ids = [r.id for r in races]
        race_drivers = list(
            session.scalars(select(RaceDriver).where(RaceDriver.race_id.in_(race_ids)))
        ) if race_ids else []
        assert len(race_drivers) == 0
