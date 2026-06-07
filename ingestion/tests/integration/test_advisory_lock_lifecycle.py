# @fileoverview Integration tests for advisory lock acquire/release on Postgres

from __future__ import annotations

import os
from uuid import uuid4

import pytest
from sqlalchemy import text

from ingestion.db import advisory_lock
from ingestion.db.session import db_session


def _advisory_lock_count(session, lock_id: int) -> int:
    return int(
        session.execute(
            text(
                """
                SELECT COUNT(*)::int
                FROM pg_locks
                WHERE locktype = 'advisory'
                  AND classid = 0
                  AND objid = :lock_id
                """
            ),
            {"lock_id": lock_id},
        ).scalar()
    )


@pytest.mark.skipif(
    not os.environ.get("DATABASE_URL") or "sqlite" in os.environ.get("DATABASE_URL", ""),
    reason="Advisory lock integration tests require Postgres (run in Docker)",
)
def test_lock_released_after_acquire_release_cycle():
    event_id = uuid4()
    key = f"event:{event_id}"
    lock_id = advisory_lock.compute_lock_id(key)

    with db_session() as session:
        handle = advisory_lock.try_acquire(session, key)
        assert handle is not None
        assert _advisory_lock_count(session, lock_id) == 1
        assert advisory_lock.release(session, handle) is True

    with db_session() as session:
        assert _advisory_lock_count(session, lock_id) == 0


@pytest.mark.skipif(
    not os.environ.get("DATABASE_URL") or "sqlite" in os.environ.get("DATABASE_URL", ""),
    reason="Advisory lock integration tests require Postgres (run in Docker)",
)
def test_lock_released_after_simulated_transaction_failure():
    event_id = uuid4()
    key = f"event:{event_id}"
    lock_id = advisory_lock.compute_lock_id(key)

    with db_session() as session:
        handle = advisory_lock.try_acquire(session, key)
        assert handle is not None
        try:
            session.execute(text("SELECT 1/0"))
        except Exception:
            session.rollback()
        assert advisory_lock.release(session, handle) is True

    with db_session() as session:
        assert _advisory_lock_count(session, lock_id) == 0
        handle2 = advisory_lock.try_acquire(session, key)
        assert handle2 is not None
        advisory_lock.release(session, handle2)

    with db_session() as session:
        assert _advisory_lock_count(session, lock_id) == 0


@pytest.mark.skipif(
    not os.environ.get("DATABASE_URL") or "sqlite" in os.environ.get("DATABASE_URL", ""),
    reason="Advisory lock integration tests require Postgres (run in Docker)",
)
def test_sequential_acquire_release_same_pool_no_stale_locks():
    keys = [f"event:{uuid4()}" for _ in range(3)]
    lock_ids = [advisory_lock.compute_lock_id(k) for k in keys]

    for key in keys:
        with db_session() as session:
            handle = advisory_lock.try_acquire(session, key)
            assert handle is not None
            assert advisory_lock.release(session, handle) is True

    with db_session() as session:
        for lock_id in lock_ids:
            assert _advisory_lock_count(session, lock_id) == 0
