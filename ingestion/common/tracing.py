"""Lightweight tracing helpers for ingestion."""

from __future__ import annotations

import time
import uuid
from contextlib import contextmanager
from typing import Iterator, Optional

from ingestion.common.logging import get_logger

logger = get_logger(__name__)


class TraceSpan:
    """Context manager that logs span start and completion."""

    def __init__(self, name: str, **attributes):
        self.name = name
        self.attributes = attributes
        self.span_id = str(uuid.uuid4())
        self._start = time.perf_counter()

    def __enter__(self) -> "TraceSpan":
        logger.info(
            "trace_span_start",
            span_id=self.span_id,
            span_name=self.name,
            **self.attributes,
        )
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        duration = time.perf_counter() - self._start
        logger.info(
            "trace_span_end",
            span_id=self.span_id,
            span_name=self.name,
            duration_seconds=duration,
            status="error" if exc_type else "ok",
            **self.attributes,
        )


@contextmanager
def start_span(name: str, **attributes) -> Iterator[TraceSpan]:
    """Convenience wrapper that yields a TraceSpan."""
    span = TraceSpan(name, **attributes)
    span.__enter__()
    try:
        yield span
    except Exception as exc:  # pragma: no cover - passthrough
        span.__exit__(type(exc), exc, exc.__traceback__)
        raise
    else:
        span.__exit__(None, None, None)


__all__ = ["TraceSpan", "start_span"]
