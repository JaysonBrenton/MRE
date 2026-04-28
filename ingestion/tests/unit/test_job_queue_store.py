"""Unit tests covering job queue ordering, cleanup, and helpers."""

from datetime import datetime, timedelta
import importlib
import threading

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


def test_ttl_zero_does_not_evict_running_jobs(job_queue):
    """With TTL=0, cleanup runs often; RUNNING records must remain visible for polling."""
    running_id = job_queue.enqueue_by_event_id(
        "00000000-0000-0000-0000-000000000011", "laps_full"
    )
    queued_id = job_queue.enqueue_by_event_id(
        "00000000-0000-0000-0000-000000000012", "laps_full"
    )
    running = job_queue.get_job(running_id)
    assert running is not None
    running.status = job_queue.JobStatus.RUNNING

    job_queue._cleanup_jobs()

    assert job_queue.get_job(running_id) is running
    assert job_queue.get_job(queued_id) is not None


def test_concurrent_enqueue_same_event_id_dedupes_to_single_job(job_queue):
    """
    Simultaneous enqueue calls must not create two active jobs for one event
    (would cause a worker to hit IngestionInProgressError on pg_try_advisory_lock).
    """
    eid = "00000000-0000-0000-0000-000000000099"
    results: list[str] = []
    results_lock = threading.Lock()
    barrier = threading.Barrier(2)

    def worker() -> None:
        barrier.wait()
        jid = job_queue.enqueue_by_event_id(eid, "laps_full")
        with results_lock:
            results.append(jid)

    t1 = threading.Thread(target=worker)
    t2 = threading.Thread(target=worker)
    t1.start()
    t2.start()
    t1.join()
    t2.join()

    assert results[0] == results[1]
    same_event = [
        j
        for j in job_queue._job_store.values()
        if j.job_type == job_queue.JobType.BY_EVENT_ID
        and j.payload.event_id == eid
    ]
    assert len(same_event) == 1


def test_running_job_includes_pipeline_stage_in_response(job_queue):
    job_id = job_queue.enqueue_by_event_id("00000000-0000-0000-0000-000000000020", "laps_full")
    job = job_queue.get_job(job_id)
    job.status = job_queue.JobStatus.RUNNING
    job.pipeline_stage = "ingest_laps"
    job.pipeline_stage_label = "Importing lap times…"

    body = job.to_response(queue_position=None)
    assert body["pipeline_stage"] == "ingest_laps"
    assert body["pipeline_stage_label"] == "Importing lap times…"
