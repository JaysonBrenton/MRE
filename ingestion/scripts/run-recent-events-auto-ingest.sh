#!/bin/bash
# @fileoverview Recent events auto-ingest wrapper for cron

set -e

export PATH="/usr/local/bin:/usr/bin:/bin:${PATH:-}"
export PYTHONPATH=/app
cd /app

[ -f /app/.env.cron ] && . /app/.env.cron

exec python3 /app/ingestion/scripts/run-recent-events-auto-ingest.py
