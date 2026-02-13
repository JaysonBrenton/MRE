# @fileoverview Unit tests for concurrent ingestion lock behavior
#
# @created 2026-02-04
# @description Verifies that when the source_event or event advisory lock cannot
#              be acquired (e.g. second concurrent request), the pipeline raises
#              IngestionInProgressError. Does not require PostgreSQL; uses mocks
#              to simulate "lock already held".
#
# See: docs/reviews/ingestion-concurrency-diagnosis-2026-02-04.md

from __future__ import annotations

from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from ingestion.ingestion.errors import IngestionInProgressError
from ingestion.ingestion.pipeline import IngestionPipeline


def _minimal_event_data(source_event_id: str):
    """Minimal ConnectorEventSummary-like object for Validator/Normalizer."""
    mock = MagicMock()
    mock.source_event_id = source_event_id
    mock.event_name = "Test Event"
    mock.event_date = date(2025, 1, 15)
    mock.event_entries = 1
    mock.event_drivers = 1
    mock.races = []
    return mock


@pytest.mark.asyncio
async def test_ingest_by_source_id_raises_when_source_event_lock_not_acquired():
    """
    When a second request tries to ingest the same source_event_id while the first
    holds the source_event lock, acquire_source_event_lock returns False and the
    pipeline must raise IngestionInProgressError.
    """
    source_event_id = "486677"
    track_id = uuid4()

    pipeline = IngestionPipeline()

    # Avoid real DB and LiveRC: mock track context and connector
    pipeline._load_track_context = MagicMock(
        return_value=MagicMock(
            track_id=track_id,
            source_track_slug="canberraoffroad",
        )
    )

    pipeline.connector.fetch_event_page = AsyncMock(
        return_value=_minimal_event_data(source_event_id)
    )
    mock_entry_list = MagicMock()
    mock_entry_list.entries_by_class = {"Mod": [MagicMock()]}
    pipeline.connector.fetch_entry_list = AsyncMock(return_value=mock_entry_list)

    # Simulate "lock already held" by another process/request
    with patch(
        "ingestion.ingestion.pipeline.Repository.acquire_source_event_lock",
        return_value=False,
    ):
        with pytest.raises(IngestionInProgressError) as exc_info:
            await pipeline.ingest_event_by_source_id(
                source_event_id=source_event_id,
                track_id=track_id,
                depth="laps_full",
            )

    assert source_event_id in str(exc_info.value)
    assert exc_info.value.code == "INGESTION_IN_PROGRESS"
