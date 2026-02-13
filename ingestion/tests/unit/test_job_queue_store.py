"""Unit tests covering job queue ordering, cleanup, and helpers."""

from datetime import datetime, timedelta
import importlib

import pytest


@pytest.fixture
def job_queue(monkeypatch):
    monkeypatch.setenv("INGESTION_USE_QUEUE", "true")
    monkeypatch.setenv("INGESTION_QUEUE_MAX_CONCURRENT", "2")
    monkeypatch.setenv("INGESTION_QUEUE_JOB_TTL_SECONDS", "0")
    import ingestion.api.job_queue as job_queue_module

    importlib.reload(job_queue_module)
    job_queue_module._reset_queue_state_for_tests()
    return job_queue_module


def test_queue_position_updates_when_head_changes(job_queue):
    job_id_1 = job_queue.enqueue_by_event_id("00000000-0000-0000-0000-000000000001", "laps_full")
    job_id_2 = job_queue.enqueue_by_event_id("00000000-0000-0000-0000-000000000002", "laps_full")
    job_id_3 = job_queue.enqueue_by_event_id("00000000-0000-0000-0000-000000000003", "laps_full")

    job1 = job_queue.get_job(job_id_1)
    job2 = job_queue.get_job(job_id_2)
    job3 = job_queue.get_job(job_id_3)

    assert job_queue.queue_position_for_job(job1) == 1
    assert job_queue.queue_position_for_job(job2) == 2
    assert job_queue.queue_position_for_job(job3) == 3

    # Simulate worker pulling first job
    job1.status = job_queue.JobStatus.RUNNING
    job_queue._remove_from_queue_order(job_id_1)

    assert job_queue.queue_position_for_job(job2) == 1
    assert job_queue.queue_position_for_job(job3) == 2


def test_completed_jobs_are_cleaned_up(job_queue):
    job_id = job_queue.enqueue_by_event_id("00000000-0000-0000-0000-000000000010", "laps_full")
    job = job_queue.get_job(job_id)
    job.status = job_queue.JobStatus.COMPLETED
    job.updated_at = datetime.utcnow() - timedelta(seconds=10)

    job_queue._cleanup_jobs()

    assert job_queue.get_job(job_id) is None
