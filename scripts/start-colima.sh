#!/bin/bash
# Script to start Colima with custom memory and CPU settings
# This can be called on login or manually

set -e

# Use ARM-native Colima if available
if [ -f "/opt/homebrew/bin/colima" ]; then
    COLIMA="/opt/homebrew/bin/colima"
else
    COLIMA="colima"
fi

# Configuration (adjust as needed)
MEMORY=14
CPUS=4

# Check if Colima is already running
if $COLIMA status 2>/dev/null | grep -q "Running"; then
    echo "Colima is already running"
    $COLIMA status
    exit 0
fi

# Start Colima with custom settings
echo "Starting Colima with ${MEMORY}GB RAM and ${CPUS} CPUs..."
$COLIMA start --memory "$MEMORY" --cpu "$CPUS"

# Switch Docker context to Colima
echo "Switching Docker context to Colima..."
docker context use colima 2>/dev/null || docker context create colima --docker "host=unix://$HOME/.colima/default/docker.sock" && docker context use colima

echo "Colima started successfully!"
$COLIMA status

