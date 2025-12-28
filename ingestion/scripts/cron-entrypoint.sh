#!/bin/bash
# @fileoverview Cron entrypoint script for ingestion service
# 
# @created 2025-01-27
# @creator Jayson Brenton
# @lastModified 2025-01-27
# 
# @description Starts cron daemon and uvicorn API server
# 
# @purpose Allows cron jobs to run in Docker container while maintaining
#          the main service functionality

set -e

# Function to handle shutdown signals
cleanup() {
    echo "Shutting down..."
    kill -TERM "$uvicorn_pid" 2>/dev/null || true
    kill -TERM "$cron_pid" 2>/dev/null || true
    wait "$uvicorn_pid" 2>/dev/null || true
    wait "$cron_pid" 2>/dev/null || true
    exit 0
}

trap cleanup SIGTERM SIGINT

# Determine if we're running as root
IS_ROOT=false
if [ "$(id -u)" = "0" ]; then
    IS_ROOT=true
fi

# Start cron daemon
echo "Starting cron daemon..."
if [ "$IS_ROOT" = "true" ]; then
    # Running as root - start cron daemon
    # Cron daemonizes itself, so we start it and then find its PID
    cron
    sleep 2
    # Find cron daemon PID
    cron_pid=$(pgrep -f "^/usr/sbin/cron$" | head -1)
    if [ -n "$cron_pid" ]; then
        echo "Cron started as root (PID: $cron_pid)"
    else
        echo "Warning: Could not verify cron daemon is running"
        cron_pid=""
    fi
else
    # Running as non-root - cron typically needs root
    echo "Warning: Running as non-root user. Cron daemon may not start."
    echo "Cron jobs may not run. Consider running container as root."
    cron_pid=""
fi

# Start uvicorn API server
# If we're root, switch to ingestion user for security
# Use multiple workers for concurrent request handling
# Workers = (2 * CPU cores) + 1, but cap at reasonable number for memory
# Default to 4 workers if UVICORN_WORKERS not set
UVICORN_WORKERS=${UVICORN_WORKERS:-4}
echo "Starting uvicorn API server with ${UVICORN_WORKERS} workers..."
if [ "$IS_ROOT" = "true" ]; then
    # Switch to ingestion user and start uvicorn
    # Use 'su ingestion' (not 'su - ingestion') to preserve environment
    # Ensure PYTHONPATH is set for the ingestion user
    su ingestion -c "export PYTHONPATH=${PYTHONPATH:-/app} && cd /app && uvicorn ingestion.api.app:app --host 0.0.0.0 --port 8000 --workers ${UVICORN_WORKERS}" &
    uvicorn_pid=$!
else
    # Already running as ingestion user
    cd /app
    export PYTHONPATH=${PYTHONPATH:-/app}
    uvicorn ingestion.api.app:app --host 0.0.0.0 --port 8000 --workers ${UVICORN_WORKERS} &
    uvicorn_pid=$!
fi

# Wait for uvicorn to start
sleep 2

# Check if uvicorn is still running
if ! kill -0 "$uvicorn_pid" 2>/dev/null; then
    echo "Error: uvicorn failed to start"
    exit 1
fi

echo "Services started successfully:"
if [ -n "$cron_pid" ]; then
    echo "  Cron PID: $cron_pid"
else
    echo "  Cron: Not running"
fi
echo "  Uvicorn PID: $uvicorn_pid"

# Wait for uvicorn process (main process)
# If uvicorn dies, the container should exit
wait "$uvicorn_pid"

