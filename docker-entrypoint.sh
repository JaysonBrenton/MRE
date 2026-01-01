#!/bin/sh
# Project: My Race Engineer
# File: docker-entrypoint.sh
# Summary: Entrypoint script to ensure dependencies are installed before starting the app
# 
# @description This script checks if node_modules exists and contains required packages.
#              If not, it installs them. This ensures that when containers are recreated
#              with anonymous volumes, dependencies are always available.

set -e

echo "🔍 Checking if node_modules exists and is up to date..."

# Determine if we need to install dependencies
NEED_INSTALL=false

# Check if node_modules directory exists
if [ ! -d "node_modules" ]; then
  echo "📦 node_modules directory not found"
  NEED_INSTALL=true
else
  # Check if package.json or package-lock.json is newer than node_modules
  # This catches cases where dependencies were added/updated
  if [ "package.json" -nt "node_modules" ] || [ "package-lock.json" -nt "node_modules" ]; then
    echo "📦 package.json or package-lock.json is newer than node_modules"
    NEED_INSTALL=true
  else
    # Verify critical packages exist (safety check for incomplete installations)
    if [ ! -d "node_modules/@visx/group" ] || [ ! -d "node_modules/react-window" ]; then
      echo "📦 Critical packages missing from node_modules"
      NEED_INSTALL=true
    fi
  fi
fi

if [ "$NEED_INSTALL" = true ]; then
  echo "📦 Installing dependencies..."
  
  # Ensure Prisma schema exists (needed for postinstall script)
  if [ ! -f "prisma/schema.prisma" ]; then
    echo "⚠️  Warning: prisma/schema.prisma not found. Prisma generate may fail."
  fi
  
  npm install --legacy-peer-deps
  echo "✅ Dependencies installed successfully"
else
  echo "✅ node_modules is up to date"
fi

# Execute the main command (npm run dev)
echo "🚀 Starting application..."
exec "$@"

