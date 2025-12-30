#!/bin/bash
# Setup script for Docker PostgreSQL database
# Run this after Docker Desktop is started

set -e

echo "🚀 Setting up Docker PostgreSQL database..."

# Step 1: Create Docker network if it doesn't exist
echo "📡 Creating Docker network..."
docker network ls | grep my-race-engineer_mre-network || docker network create my-race-engineer_mre-network
echo "✅ Network ready"

# Step 2: Check if PostgreSQL container already exists
if docker ps -a | grep -q mre-postgres; then
    echo "📦 PostgreSQL container exists, checking status..."
    if docker ps | grep -q mre-postgres; then
        echo "✅ PostgreSQL container is already running"
    else
        echo "🔄 Starting existing PostgreSQL container..."
        docker start mre-postgres
        echo "✅ PostgreSQL container started"
    fi
else
    echo "📦 Creating PostgreSQL container..."
    docker run -d \
      --name mre-postgres \
      --network my-race-engineer_mre-network \
      -e POSTGRES_USER=pacetracer \
      -e POSTGRES_PASSWORD=change-me \
      -e POSTGRES_DB=pacetracer \
      -p 5432:5432 \
      postgres:16
    echo "✅ PostgreSQL container created and started"
    
    # Wait for PostgreSQL to be ready
    echo "⏳ Waiting for PostgreSQL to be ready..."
    sleep 5
    for i in {1..30}; do
        if docker exec mre-postgres pg_isready -U pacetracer > /dev/null 2>&1; then
            echo "✅ PostgreSQL is ready!"
            break
        fi
        echo "   Waiting... ($i/30)"
        sleep 1
    done
fi

# Step 3: Run database migrations
echo "📊 Running database migrations..."
npx prisma migrate deploy
echo "✅ Migrations completed"

# Step 4: Seed the database (creates admin user)
echo "🌱 Seeding database..."
npx prisma db seed
echo "✅ Database seeded"

# Step 5: Verify setup
echo "🔍 Verifying setup..."
docker ps | grep mre-postgres
echo ""
echo "✅ Database setup complete!"
echo ""
echo "📝 Admin credentials:"
echo "   Email: admin@mre.local"
echo "   Password: admin123456"
echo ""
echo "🧪 You can now:"
echo "   1. Try logging in at http://localhost:3001/login"
echo "   2. Run Playwright tests: npm run test:e2e"

