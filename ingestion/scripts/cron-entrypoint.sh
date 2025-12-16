#!/bin/bash
# @fileoverview Cron entrypoint script for ingestion service
# 
# @created 2025-01-27
# @creator Jayson Brenton
# @lastModified 2025-01-27
# 
# @description Starts cron daemon and keeps container running
# 
# @purpose Allows cron jobs to run in Docker container while maintaining
#          the main service functionality

set -e

# Start cron daemon in background
echo "Starting cron daemon..."
cron

# Keep container running
# If running as non-root, we need to use a different approach
# For now, we'll use tail to keep the process alive
tail -f /dev/null

