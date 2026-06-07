# @fileoverview PostgreSQL session advisory lock acquire/release with verified unlock
#
# @description Advisory locks are connection-scoped. This module ensures unlock is
#              checked via pg_advisory_unlock return value and invalidates pooled
#              connections when unlock fails.

from __future__ import annotations

import hashlib
import sys
from dataclasses import dataclass
from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from ingestion.common import metrics
from ingestion.common.logging import get_logger

logger = get_logger(__name__)


@dataclass(frozen=True)
class AdvisoryLockHandle:
    lock_id: int
    backend_pid: int
    key: str


def compute_lock_id(key: str) -> int:
    """Compute a deterministic advisory lock ID from a string key."""
    hash_bytes = hashlib.sha256(key.encode("utf-8")).digest()
    return int.from_bytes(hash_bytes[:8], byteorder="big") % (2**31)


def _get_backend_pid(session: Session) -> int:
    return int(session.execute(text("SELECT pg_backend_pid()")).scalar())


def _session_needs_rollback(session: Session) -> bool:
    if sys.exc_info()[0] is not None:
        return True
    try:
        trans = session.get_transaction()
        if trans is not None and not trans.is_active:
            return True
    except Exception:
        return True
    return False


def _rollback_session(session: Session, handle: AdvisoryLockHandle, *, context: str) -> None:
    try:
        session.rollback()
    except Exception as rollback_exc:
        logger.error(
            "advisory_lock_release_rollback_failed",
            key=handle.key,
            lock_id=handle.lock_id,
            acquire_pid=handle.backend_pid,
            context=context,
            error=str(rollback_exc),
            exc_info=True,
        )


def _invalidate_session(session: Session, handle: AdvisoryLockHandle) -> None:
    try:
        session.invalidate()
    except Exception as invalidate_exc:
        logger.critical(
            "advisory_lock_release_invalidate_failed",
            key=handle.key,
            lock_id=handle.lock_id,
            acquire_pid=handle.backend_pid,
            error=str(invalidate_exc),
            exc_info=True,
        )


def _execute_unlock(session: Session, lock_id: int) -> bool:
    released = session.execute(
        text("SELECT pg_advisory_unlock(:lock_id)").bindparams(lock_id=lock_id)
    ).scalar()
    return bool(released)


def try_acquire(session: Session, key: str) -> Optional[AdvisoryLockHandle]:
    """Attempt pg_try_advisory_lock; return None if not acquired."""
    lock_id = compute_lock_id(key)
    acquired = session.execute(
        text("SELECT pg_try_advisory_lock(:lock_id)").bindparams(lock_id=lock_id)
    ).scalar()
    if not acquired:
        metrics.record_advisory_lock_acquire_conflict()
        return None

    backend_pid = _get_backend_pid(session)
    handle = AdvisoryLockHandle(lock_id=lock_id, backend_pid=backend_pid, key=key)
    logger.info(
        "advisory_lock_acquired",
        key=key,
        lock_id=lock_id,
        backend_pid=backend_pid,
    )
    return handle


def release(session: Session, handle: AdvisoryLockHandle) -> bool:
    """
    Release an advisory lock on the current session backend.

    Returns True when pg_advisory_unlock reports the lock was held and released.
    On failure, invalidates the connection so locks cannot leak to the pool.
    """
    pending_exception = sys.exc_info()[0] is not None

    if _session_needs_rollback(session):
        _rollback_session(session, handle, context="pre_unlock")

    release_pid: Optional[int] = None
    try:
        release_pid = _get_backend_pid(session)
        if _execute_unlock(session, handle.lock_id):
            logger.info(
                "advisory_lock_released",
                key=handle.key,
                lock_id=handle.lock_id,
                acquire_pid=handle.backend_pid,
                release_pid=release_pid,
            )
            return True

        logger.critical(
            "advisory_lock_release_failed",
            key=handle.key,
            lock_id=handle.lock_id,
            acquire_pid=handle.backend_pid,
            release_pid=release_pid,
        )
        metrics.record_advisory_lock_release_failure()
        _invalidate_session(session, handle)
        return False

    except Exception as exc:
        logger.error(
            "advisory_lock_release_exception",
            key=handle.key,
            lock_id=handle.lock_id,
            acquire_pid=handle.backend_pid,
            release_pid=release_pid,
            error=str(exc),
            exc_info=True,
        )
        _rollback_session(session, handle, context="after_exception")

    try:
        release_pid = _get_backend_pid(session)
        if _execute_unlock(session, handle.lock_id):
            logger.warning(
                "advisory_lock_release_recovered_after_rollback",
                key=handle.key,
                lock_id=handle.lock_id,
                acquire_pid=handle.backend_pid,
                release_pid=release_pid,
            )
            return True
    except Exception as retry_exc:
        logger.critical(
            "advisory_lock_release_retry_failed",
            key=handle.key,
            lock_id=handle.lock_id,
            acquire_pid=handle.backend_pid,
            release_pid=release_pid,
            error=str(retry_exc),
            exc_info=True,
        )

    metrics.record_advisory_lock_release_failure()
    _invalidate_session(session, handle)
    if not pending_exception:
        raise RuntimeError(
            f"Failed to release advisory lock for {handle.key} (lock_id={handle.lock_id})"
        )
    return False
