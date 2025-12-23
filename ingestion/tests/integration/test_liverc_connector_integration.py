"""Integration tests for LiveRC connector using HTML fixtures."""

from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from ingestion.connectors.liverc.connector import LiveRCConnector
from ingestion.ingestion.errors import ConnectorHTTPError, EventPageFormatError


@pytest.fixture(scope="module")
def liverc_fixture_dir() -> Path:
    return Path(__file__).parent.parent / "fixtures" / "liverc"


@pytest.fixture(scope="module")
def event_metadata(liverc_fixture_dir: Path) -> dict:
    metadata_path = liverc_fixture_dir / "486677" / "metadata.json"
    return json.loads(metadata_path.read_text(encoding="utf-8"))


@pytest.fixture(autouse=True)
def stub_http_clients(monkeypatch, liverc_fixture_dir: Path, event_metadata: dict):
    track_slug = event_metadata["tracks"]["track_slug"]
    event_id = event_metadata["event_id"]
    event_url = f"https://{track_slug}.liverc.com/results/?p=view_event&id={event_id}"

    http_map: dict[str, str] = {
        "https://live.liverc.com": (liverc_fixture_dir / "track_catalogue.html").read_text(encoding="utf-8"),
        f"https://{track_slug}.liverc.com/events": (liverc_fixture_dir / "canberraoffroad_events.html").read_text(encoding="utf-8"),
        # Minimal HTML here forces Playwright fallback for event metadata.
        event_url: "<html><body>Loading...</body></html>",
    }

    for race_id in event_metadata["races_expected"]:
        race_path = liverc_fixture_dir / "486677" / f"race.{race_id}.html"
        http_map[f"https://{track_slug}.liverc.com/results/?p=view_race_result&id={race_id}"] = race_path.read_text(encoding="utf-8")

    playwright_map = {
        event_url: (liverc_fixture_dir / "486677" / "event.html").read_text(encoding="utf-8"),
    }

    class StubHTTPXClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url: str):
            html = http_map.get(url)
            if html is None:
                raise ConnectorHTTPError(f"Unexpected URL: {url}", url=url)
            return SimpleNamespace(text=html, status_code=200, is_success=True)

    class StubPlaywrightClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def fetch_page(self, url: str, wait_for_selector: str | None = None, timeout: int = 30000):
            html = playwright_map.get(url)
            if html is None:
                raise EventPageFormatError(f"No Playwright fixture for {url}", url=url)
            return html

    monkeypatch.setattr("ingestion.connectors.liverc.connector.HTTPXClient", StubHTTPXClient)
    monkeypatch.setattr("ingestion.connectors.liverc.connector.PlaywrightClient", StubPlaywrightClient)


@pytest.mark.asyncio
async def test_event_summary_uses_playwright_fallback(event_metadata: dict):
    connector = LiveRCConnector()
    summary = await connector.fetch_event_page(
        track_slug=event_metadata["tracks"]["track_slug"],
        source_event_id=event_metadata["event_id"],
    )

    assert summary.source_event_id == event_metadata["event_id"]
    assert summary.event_name
    race_ids = sorted(race.source_race_id for race in summary.races)
    assert race_ids == sorted(str(rid) for rid in event_metadata["races_expected"])


@pytest.mark.asyncio
async def test_race_package_matches_fixture_metadata(event_metadata: dict):
    connector = LiveRCConnector()
    summary = await connector.fetch_event_page(
        track_slug=event_metadata["tracks"]["track_slug"],
        source_event_id=event_metadata["event_id"],
    )
    target_race_id = str(event_metadata["races_expected"][0])
    race_summary = next(r for r in summary.races if r.source_race_id == target_race_id)

    race_package = await connector.fetch_race_page(race_summary)

    assert race_package.results, "Race results should be parsed"
    for driver_id, expected_laps in event_metadata["laps_expected"].items():
        laps = race_package.laps_by_driver.get(str(driver_id))
        if laps:
            assert len(laps) == expected_laps
