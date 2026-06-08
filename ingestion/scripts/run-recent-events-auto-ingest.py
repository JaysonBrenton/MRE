#!/usr/bin/env python3
"""Recent events auto-ingest wrapper — reads effective settings from DB/env."""

from __future__ import annotations

import random
import subprocess
import sys
import time

from ingestion.common.settings import get_bool, get_int, get_str


def main() -> int:
    if not get_bool("MRE_SCRAPE_ENABLED"):
        print("recent events auto-ingest skipped (MRE_SCRAPE_ENABLED != true)")
        return 0
    if not get_bool("MRE_RECENT_EVENTS_AUTO_INGEST_ENABLED"):
        print("recent events auto-ingest skipped (MRE_RECENT_EVENTS_AUTO_INGEST_ENABLED != true)")
        return 0

    time.sleep(random.randint(0, 119))

    cmd = [
        sys.executable,
        "-m",
        "ingestion.cli",
        "ingest",
        "liverc",
        "refresh-recent-events",
        "--days",
        str(get_int("MRE_RECENT_EVENTS_DAYS")),
        "--tracks",
        get_str("MRE_RECENT_EVENTS_TRACKS"),
        "--max-ingests",
        str(get_int("MRE_RECENT_EVENTS_MAX_INGESTS")),
        "--min-event-age-hours",
        str(get_int("MRE_RECENT_EVENTS_MIN_AGE_HOURS")),
        "--quiet",
    ]
    subprocess.check_call(cmd)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
