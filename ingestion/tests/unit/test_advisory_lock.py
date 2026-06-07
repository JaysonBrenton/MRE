# @fileoverview Unit tests for ingestion.db.advisory_lock

from __future__ import annotations

from unittest.mock import MagicMock
from uuid import UUID

from ingestion.db import advisory_lock


def test_compute_lock_id_stable_for_known_uuid():
    event_id = UUID("152528b7-0000-4000-8000-000000000001")
    key = f"event:{event_id}"
    first = advisory_lock.compute_lock_id(key)
    second = advisory_lock.compute_lock_id(key)
    assert first == second
    assert 0 <= first < 2**31


def test_try_acquire_returns_none_when_not_acquired():
    session = MagicMock()
    session.execute.return_value.scalar.return_value = False

    handle = advisory_lock.try_acquire(session, "event:abc")

    assert handle is None
    session.execute.assert_called_once()


def test_try_acquire_returns_handle_when_acquired():
    session = MagicMock()
    session.execute.return_value.scalar.side_effect = [True, 4242]

    handle = advisory_lock.try_acquire(session, "source_event:486677")

    assert handle is not None
    assert handle.backend_pid == 4242
    assert handle.key == "source_event:486677"
    assert handle.lock_id == advisory_lock.compute_lock_id("source_event:486677")


def test_release_returns_true_when_unlock_succeeds():
    session = MagicMock()
    session.get_transaction.return_value = None
    session.execute.return_value.scalar.side_effect = [99, True]
    handle = advisory_lock.AdvisoryLockHandle(
        lock_id=123,
        backend_pid=99,
        key="event:test",
    )

    assert advisory_lock.release(session, handle) is True
    unlock_calls = [
        c
        for c in session.execute.call_args_list
        if "pg_advisory_unlock" in str(c.args[0])
    ]
    assert len(unlock_calls) == 1


def test_release_invalidates_when_unlock_returns_false():
    session = MagicMock()
    session.get_transaction.return_value = None
    session.execute.return_value.scalar.side_effect = [99, False]
    handle = advisory_lock.AdvisoryLockHandle(
        lock_id=456,
        backend_pid=99,
        key="event:test",
    )

    assert advisory_lock.release(session, handle) is False
    session.invalidate.assert_called_once()


def test_release_rolls_back_before_unlock_when_transaction_inactive():
    session = MagicMock()
    trans = MagicMock()
    trans.is_active = False
    session.get_transaction.return_value = trans
    session.execute.return_value.scalar.side_effect = [10, True]
    handle = advisory_lock.AdvisoryLockHandle(lock_id=1, backend_pid=10, key="event:x")

    advisory_lock.release(session, handle)

    session.rollback.assert_called()
    assert any(
        "pg_advisory_unlock" in str(c.args[0])
        for c in session.execute.call_args_list
    )


def test_release_retries_after_unlock_exception():
    session = MagicMock()
    session.get_transaction.return_value = None
    pid_result = MagicMock()
    pid_result.scalar.return_value = 77
    fail_unlock = MagicMock()
    fail_unlock.scalar.side_effect = Exception("tx aborted")
    ok_unlock = MagicMock()
    ok_unlock.scalar.return_value = True
    session.execute.side_effect = [pid_result, fail_unlock, pid_result, ok_unlock]
    handle = advisory_lock.AdvisoryLockHandle(lock_id=2, backend_pid=77, key="event:y")

    assert advisory_lock.release(session, handle) is True
    session.rollback.assert_called()
    assert session.execute.call_count == 4
