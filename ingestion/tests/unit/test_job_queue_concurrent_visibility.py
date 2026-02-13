# @fileoverview Unit tests for ingestion job queue: concurrent job visibility
#
# @description With a single Uvicorn worker, all jobs live in one process.
#              Two enqueued jobs must both be visible via get_job so status
#              polling never gets 404. This test asserts that behaviour.

import os

import pytest

from ingestion.api.job_queue import (
    enqueue_by_event_id,
    get_job,
    is_queue_enabled,
)


@pytest.fixture(autouse=True)
def ensure_queue_enabled(monkeypatch):
    """Ensure queue is enabled so enqueue_* actually adds to store."""
    monkeypatch.setenv("INGESTION_USE_QUEUE", "true")


def test_two_queued_jobs_both_visible_via_get_job():
    """Two enqueued jobs must both be visible via get_job (single-process store).
    Regression test for 'Failed to get job status: Not Found' when two users import at once.
    """
    assert is_queue_enabled()
    job_id_1 = enqueue_by_event_id("00000000-0000-0000-0000-000000000001", "laps_full")
    job_id_2 = enqueue_by_event_id("00000000-0000-0000-0000-000000000002", "laps_full")
    assert job_id_1 != job_id_2

    job_1 = get_job(job_id_1)
    job_2 = get_job(job_id_2)
    assert job_1 is not None, "First job must be visible (single worker)"
    assert job_2 is not None, "Second job must be visible (single worker)"
    assert job_1.job_id == job_id_1
    assert job_2.job_id == job_id_2
    assert job_1.status.value == "queued"
    assert job_2.status.value == "queued"
