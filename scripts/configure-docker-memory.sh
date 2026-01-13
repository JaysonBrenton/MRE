#!/bin/bash
# Script to help configure Docker Desktop for maximum memory allocation
# This script provides instructions and checks current Docker Desktop memory settings

echo "=========================================="
echo "Docker Memory Configuration Helper"
echo "=========================================="
echo ""

# Check total system RAM
TOTAL_RAM_GB=$(sysctl -n hw.memsize | awk '{print int($1/1024/1024/1024)}')
echo "System Total RAM: ${TOTAL_RAM_GB}GB"
echo ""

# Get Docker Desktop memory allocation (if accessible)
if command -v docker &> /dev/null; then
    echo "Checking Docker info..."
    docker info 2>/dev/null | grep -i "total memory" || echo "Could not read Docker memory info"
    echo ""
fi

echo "RECOMMENDED: Configure Docker Desktop for Maximum RAM"
echo "=========================================="
echo ""
echo "To maximize RAM available to Docker containers:"
echo ""
echo "1. Open Docker Desktop application"
echo "2. Go to Settings (gear icon) → Resources → Advanced"
echo "3. Set Memory to maximum (recommended: $(($TOTAL_RAM_GB - 4))GB or higher)"
echo "   - Leave at least 4GB for macOS system processes"
echo "   - On an ${TOTAL_RAM_GB}GB system, allocate $(($TOTAL_RAM_GB - 4))GB to Docker"
echo ""
echo "4. Click 'Apply & Restart'"
echo ""
echo "Current docker-compose.yml Configuration:"
echo "  - mre-app: up to 12GB"
echo "  - mre-liverc-ingestion-service: up to 8GB"
echo "  - Total possible usage: 20GB (requires Docker Desktop to have sufficient RAM allocated)"
echo ""
echo "After configuring Docker Desktop:"
echo "  docker compose down"
echo "  docker compose up -d"
echo ""
echo "To verify memory usage:"
echo "  docker stats"
echo ""

