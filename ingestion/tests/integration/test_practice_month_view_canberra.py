"""Integration test: fetch LiveRC Canberra October 2025 practice calendar and assert we get all 3 practice days."""

from __future__ import annotations

import asyncio
from datetime import date

import pytest

from ingestion.connectors.liverc.connector import LiveRCConnector


@pytest.mark.asyncio
async def test_canberra_october_2025_returns_three_practice_days():
    """Fetch real LiveRC page for Canberra October 2025; parser must return Oct 11, 12, 25."""
    connector = LiveRCConnector()
    dates = await connector.fetch_practice_month_view(
        track_slug="canberraoffroad",
        year=2025,
        month=10,
    )
    expected = {date(2025, 10, 11), date(2025, 10, 12), date(2025, 10, 25)}
    assert len(dates) >= 3, f"Expected at least 3 practice days for Oct 2025, got {len(dates)}: {dates}"
    found = set(dates)
    assert expected.issubset(found), f"Expected {expected}, got {found}"
