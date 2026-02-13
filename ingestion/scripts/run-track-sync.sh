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

# Cron runs with minimal PATH; ensure python3 is found (e.g. /usr/local/bin)
export PATH="/usr/local/bin:/usr/bin:/bin:${PATH:-}"

# Load container env (DATABASE_URL, MRE_SCRAPE_ENABLED) written by entrypoint
[ -f /app/.env.cron ] && . /app/.env.cron

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
python3 -m ingestion.cli ingest liverc refresh-tracks
