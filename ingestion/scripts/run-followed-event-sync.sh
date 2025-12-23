#!/bin/bash
# @fileoverview Event refresh wrapper script for followed tracks
#
# Automates metadata refresh for all followed LiveRC tracks.

set -e
export PYTHONPATH=/app
cd /app
python -m ingestion.cli ingest liverc refresh-followed-events --depth none
