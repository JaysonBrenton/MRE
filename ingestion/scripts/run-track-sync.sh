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

# Set Python path
export PYTHONPATH=/app

# Change to app directory
cd /app

# Execute track sync command
python -m ingestion.cli ingest liverc refresh-tracks

