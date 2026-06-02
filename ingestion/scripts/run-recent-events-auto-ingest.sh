#!/bin/bash
# @fileoverview Recent events auto-ingest wrapper for cron
#
# Discovers and full-ingests recent LiveRC events for followed tracks (defaults).

set -e

export PATH="/usr/local/bin:/usr/bin:/bin:${PATH:-}"

[ -f /app/.env.cron ] && . /app/.env.cron

if [ "${MRE_SCRAPE_ENABLED:-true}" != "true" ]; then
  echo "recent events auto-ingest skipped (MRE_SCRAPE_ENABLED != true)"
  exit 0
fi

if [ "${MRE_RECENT_EVENTS_AUTO_INGEST_ENABLED:-false}" != "true" ]; then
  echo "recent events auto-ingest skipped (MRE_RECENT_EVENTS_AUTO_INGEST_ENABLED != true)"
  exit 0
fi

sleep $((RANDOM % 120))
export PYTHONPATH=/app
cd /app

DAYS="${MRE_RECENT_EVENTS_DAYS:-7}"
TRACKS="${MRE_RECENT_EVENTS_TRACKS:-followed}"
MAX="${MRE_RECENT_EVENTS_MAX_INGESTS:-50}"
MIN_AGE="${MRE_RECENT_EVENTS_MIN_AGE_HOURS:-12}"

python3 -m ingestion.cli ingest liverc refresh-recent-events \
  --days "$DAYS" \
  --tracks "$TRACKS" \
  --max-ingests "$MAX" \
  --min-event-age-hours "$MIN_AGE" \
  --quiet
