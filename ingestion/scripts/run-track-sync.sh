#!/bin/bash
# @fileoverview Track sync wrapper script for cron
# 
# @created 2025-01-27
# @creator Jayson Brenton
# @lastModified 2025-01-27
# 
# @description Executes track sync command with proper environment
# 
# @purpose Ensures track sync runs with correct Python path and environment

set -e

if [ "${MRE_SCRAPE_ENABLED:-true}" != "true" ]; then
  echo "track sync skipped (MRE_SCRAPE_ENABLED != true)"
  exit 0
fi

# Small jitter (0-120s) to avoid thundering herd at cron minute
sleep $((RANDOM % 120))

# Set Python path
export PYTHONPATH=/app

# Change to app directory
cd /app

# Execute track sync command
python -m ingestion.cli ingest liverc refresh-tracks
