#!/bin/bash
# @fileoverview Event refresh wrapper script for followed tracks
#
# Automates metadata refresh for all followed LiveRC tracks.

set -e

if [ "${MRE_SCRAPE_ENABLED:-true}" != "true" ]; then
  echo "followed event refresh skipped (MRE_SCRAPE_ENABLED != true)"
  exit 0
fi

sleep $((RANDOM % 120))
export PYTHONPATH=/app
cd /app
python3 -m ingestion.cli ingest liverc refresh-followed-events --depth none
