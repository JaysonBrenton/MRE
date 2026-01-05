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
    if [ ! -d "node_modules/@visx/group" ] || [ ! -d "node_modules/react-window" ] || [ ! -d "node_modules/react-redux" ]; then
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

# Check if Prisma client needs to be regenerated
# This is important when the schema changes but node_modules doesn't need reinstalling
NEED_PRISMA_GENERATE=false

if [ -f "prisma/schema.prisma" ]; then
  # Check if Prisma client exists
  if [ ! -d "node_modules/.prisma/client" ]; then
    echo "🔧 Prisma client not found"
    NEED_PRISMA_GENERATE=true
  else
    # Check if schema is newer than generated client
    # Use a more reliable method that works on Alpine Linux
    if [ -f "node_modules/.prisma/client/index.d.ts" ]; then
      # Compare modification times using find (works on all systems)
      SCHEMA_MTIME=$(find "prisma/schema.prisma" -printf "%T@\n" 2>/dev/null || stat -c %Y "prisma/schema.prisma" 2>/dev/null || stat -f %m "prisma/schema.prisma" 2>/dev/null || echo "0")
      CLIENT_MTIME=$(find "node_modules/.prisma/client/index.d.ts" -printf "%T@\n" 2>/dev/null || stat -c %Y "node_modules/.prisma/client/index.d.ts" 2>/dev/null || stat -f %m "node_modules/.prisma/client/index.d.ts" 2>/dev/null || echo "0")
      
      # Convert to integers for comparison (handle floating point from find)
      SCHEMA_TIME=$(echo "$SCHEMA_MTIME" | cut -d. -f1)
      CLIENT_TIME=$(echo "$CLIENT_MTIME" | cut -d. -f1)
      
      if [ "$SCHEMA_TIME" -gt "$CLIENT_TIME" ]; then
        echo "🔧 Prisma schema is newer than generated client"
        NEED_PRISMA_GENERATE=true
      fi
    else
      echo "🔧 Prisma client index.d.ts not found"
      NEED_PRISMA_GENERATE=true
    fi
    
    # Additional safety check: verify auditLog exists in generated client
    # This catches cases where the client exists but is missing models
    if [ "$NEED_PRISMA_GENERATE" = false ] && [ -f "node_modules/.prisma/client/index.d.ts" ]; then
      if ! grep -q "auditLog" "node_modules/.prisma/client/index.d.ts" 2>/dev/null; then
        echo "🔧 Prisma client missing expected models (auditLog not found)"
        NEED_PRISMA_GENERATE=true
      fi
    fi
  fi
fi

if [ "$NEED_PRISMA_GENERATE" = true ]; then
  echo "🔧 Regenerating Prisma client..."
  npx prisma generate
  echo "✅ Prisma client regenerated successfully"
else
  echo "✅ Prisma client is up to date"
fi

# Execute the main command (npm run dev)
echo "🚀 Starting application..."
exec "$@"

