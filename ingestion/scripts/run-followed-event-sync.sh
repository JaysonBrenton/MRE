#!/bin/bash
# @fileoverview Event refresh wrapper script for followed tracks
#
# Automates metadata refresh for all followed LiveRC tracks.

set -e

# Cron runs with minimal PATH; ensure python3 is found (e.g. /usr/local/bin)
export PATH="/usr/local/bin:/usr/bin:/bin:${PATH:-}"

# Load container env (DATABASE_URL, MRE_SCRAPE_ENABLED) written by entrypoint
[ -f /app/.env.cron ] && . /app/.env.cron

if [ "${MRE_SCRAPE_ENABLED:-true}" != "true" ]; then
  echo "followed event refresh skipped (MRE_SCRAPE_ENABLED != true)"
  exit 0
fi

sleep $((RANDOM % 120))
export PYTHONPATH=/app
cd /app
python3 -m ingestion.cli ingest liverc refresh-followed-events --depth none
