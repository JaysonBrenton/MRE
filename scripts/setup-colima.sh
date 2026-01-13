#!/bin/bash
# Setup script for Colima Docker runtime on macOS
# This script helps configure Colima as an alternative to Docker Desktop

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "Colima Docker Runtime Setup"
echo "=========================================="
echo ""

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo -e "${RED}Error: This script is for macOS only${NC}"
    exit 1
fi

# Detect system architecture
ARCH=$(uname -m)
echo "System architecture: $ARCH"

# Detect available Homebrew
if [ -f "/opt/homebrew/bin/brew" ]; then
    BREW="/opt/homebrew/bin/brew"
    echo "Using ARM Homebrew: $BREW"
elif [ -f "/usr/local/bin/brew" ]; then
    BREW="/usr/local/bin/brew"
    echo "Using Intel Homebrew: $BREW"
else
    echo -e "${RED}Error: Homebrew not found${NC}"
    echo "Please install Homebrew from https://brew.sh"
    exit 1
fi

# Check if Colima is installed
if ! command -v colima &> /dev/null; then
    echo -e "${YELLOW}Colima not found. Installing...${NC}"
    $BREW install colima
else
    echo -e "${GREEN}Colima is already installed${NC}"
    colima --version
fi

# Get system RAM
TOTAL_RAM_GB=$(sysctl -n hw.memsize | awk '{printf "%.0f\n", $1/1024/1024/1024}')
echo ""
echo "System Total RAM: ${TOTAL_RAM_GB}GB"

# Calculate recommended Colima memory
if [ "$TOTAL_RAM_GB" -ge 18 ]; then
    RECOMMENDED_MEM=14
elif [ "$TOTAL_RAM_GB" -ge 16 ]; then
    RECOMMENDED_MEM=12
elif [ "$TOTAL_RAM_GB" -ge 8 ]; then
    RECOMMENDED_MEM=6
else
    RECOMMENDED_MEM=4
fi

echo "Recommended Colima memory: ${RECOMMENDED_MEM}GB (leaving $(($TOTAL_RAM_GB - $RECOMMENDED_MEM))GB for macOS)"

# Ask user for memory allocation
read -p "Enter memory allocation for Colima (GB) [${RECOMMENDED_MEM}]: " MEM_INPUT
MEMORY=${MEM_INPUT:-$RECOMMENDED_MEM}

# Ask for CPU allocation
CPU_COUNT=$(sysctl -n hw.ncpu)
RECOMMENDED_CPU=$((CPU_COUNT / 2))
if [ "$RECOMMENDED_CPU" -lt 2 ]; then
    RECOMMENDED_CPU=2
fi

echo "System CPU cores: ${CPU_COUNT}"
read -p "Enter CPU allocation for Colima [${RECOMMENDED_CPU}]: " CPU_INPUT
CPUS=${CPU_INPUT:-$RECOMMENDED_CPU}

# Check Colima status
if colima status 2>/dev/null | grep -q "Running"; then
    echo ""
    echo -e "${YELLOW}Colima is already running. Stopping to apply new settings...${NC}"
    colima stop
fi

# Start Colima with specified settings
echo ""
echo -e "${GREEN}Starting Colima with ${MEMORY}GB RAM and ${CPUS} CPUs...${NC}"
colima start --memory "$MEMORY" --cpu "$CPUS"

# Wait for Colima to be ready
echo "Waiting for Colima to be ready..."
sleep 5

# Setup Docker context
echo ""
echo "Setting up Docker context..."
docker context create colima --docker "host=unix://$HOME/.colima/default/docker.sock" 2>/dev/null || true
docker context use colima

# Verify setup
echo ""
echo "Verifying setup..."
if docker info 2>/dev/null | grep -q "Total Memory"; then
    DOCKER_MEM=$(docker info 2>/dev/null | grep "Total Memory" | awk '{print $3}')
    echo -e "${GREEN}✓ Docker is configured with ${DOCKER_MEM}${NC}"
    echo -e "${GREEN}✓ Docker context: $(docker context ls | grep '\*' | awk '{print $1}')${NC}"
else
    echo -e "${RED}✗ Failed to verify Docker setup${NC}"
    exit 1
fi

echo ""
echo "=========================================="
echo -e "${GREEN}Colima setup complete!${NC}"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Run: docker compose up -d"
echo "  2. Verify: docker ps"
echo ""
echo "To stop Colima: colima stop"
echo "To start Colima: colima start --memory ${MEMORY} --cpu ${CPUS}"
echo "To switch back to Docker Desktop: docker context use desktop-linux"
echo ""

