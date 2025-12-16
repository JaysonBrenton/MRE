#!/bin/sh
# Project: My Race Engineer
# File: docker-entrypoint.sh
# Summary: Entrypoint script to ensure dependencies are installed before starting the app
# 
# @description This script checks if node_modules exists and contains required packages.
#              If not, it installs them. This ensures that when containers are recreated
#              with anonymous volumes, dependencies are always available.

set -e

echo "🔍 Checking if node_modules exists and contains packages..."

# Check if node_modules exists and has required packages (check multiple critical packages)
# Check for @visx/group and react-window to ensure all dependencies are installed
if [ ! -d "node_modules" ] || [ ! -d "node_modules/@visx/group" ] || [ ! -d "node_modules/react-window" ]; then
  echo "📦 node_modules missing or incomplete. Installing dependencies..."
  
  # Ensure Prisma schema exists (needed for postinstall script)
  if [ ! -f "prisma/schema.prisma" ]; then
    echo "⚠️  Warning: prisma/schema.prisma not found. Prisma generate may fail."
  fi
  
  npm install --legacy-peer-deps
  echo "✅ Dependencies installed successfully"
else
  echo "✅ node_modules already exists with required packages"
fi

# Execute the main command (npm run dev)
echo "🚀 Starting application..."
exec "$@"

