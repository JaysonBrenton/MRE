---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: Step-by-step developer onboarding guide for MRE application
purpose: Provides a comprehensive quick start guide for new developers, including
         prerequisites, setup instructions, first-time workflow, and troubleshooting.
         Accelerates developer onboarding and reduces setup friction.
relatedFiles:
  - README.md (project overview and basic setup)
  - docs/reviews/DOCKER_REVIEW_REPORT.md (Docker setup details)
  - docs/operations/environment-variables.md (environment configuration)
  - docs/operations/liverc-operations-guide.md (operational commands)
---

# Developer Quick Start Guide

**Last Updated:** 2025-01-27  
**Target Audience:** New developers joining the MRE project

This guide provides step-by-step instructions for setting up the MRE development environment and getting started with development.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Running the Application](#running-the-application)
4. [First-Time Developer Workflow](#first-time-developer-workflow)
5. [Running Tests](#running-tests)
6. [Useful Development Commands](#useful-development-commands)
7. [Common Setup Issues](#common-setup-issues)
8. [IDE/Editor Recommendations](#ideeditor-recommendations)
9. [Next Steps](#next-steps)

---

## Prerequisites

Before starting, ensure you have the following installed:

### Required Software

- **Docker** (version 20.10 or later)
  - Download: https://www.docker.com/products/docker-desktop
  - Verify: `docker --version`

- **Docker Compose** (version 2.0 or later)
  - Usually included with Docker Desktop
  - Verify: `docker compose version`

- **Git** (version 2.30 or later)
  - Download: https://git-scm.com/downloads
  - Verify: `git --version`

### Optional but Recommended

- **Node.js** (version 20 or later) - For running scripts and Prisma CLI locally
  - Download: https://nodejs.org/
  - Verify: `node --version`

- **VS Code** or **Cursor** - Recommended IDE with TypeScript support
  - VS Code: https://code.visualstudio.com/
  - Cursor: https://cursor.sh/

### System Requirements

- **Operating System:** macOS, Linux, or Windows (with WSL2)
- **RAM:** Minimum 8GB (16GB recommended)
- **Disk Space:** At least 5GB free space

---

## Initial Setup

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd mre
```

### Step 2: Verify Docker Network

The application requires a Docker network named `my-race-engineer_mre-network`. Check if it exists:

```bash
docker network ls | grep my-race-engineer_mre-network
```

If it doesn't exist, create it:

```bash
docker network create my-race-engineer_mre-network
```

### Step 3: Verify PostgreSQL Container

The application connects to an existing PostgreSQL container named `mre-postgres` on the network. Verify it exists:

```bash
docker ps -a | grep mre-postgres
```

If the container doesn't exist, you'll need to set it up. See [Common Setup Issues](#common-setup-issues) for PostgreSQL setup instructions.

### Step 4: Configure Environment Variables

Create a `.env.docker` file in the project root (if it doesn't exist):

```bash
cp .env.docker.example .env.docker  # If example exists
# Or create manually
```

Minimum required variables (see `docs/operations/environment-variables.md` for complete list):

```bash
DATABASE_URL=postgresql://pacetracer:change-me@mre-postgres:5432/pacetracer?schema=public
AUTH_SECRET=development-secret-change-in-production
NODE_ENV=development
```

### Step 5: Build Docker Images

Build the application and ingestion service images:

```bash
docker compose build
```

This may take several minutes on first run as it downloads base images and installs dependencies.

---

## Running the Application

### Start All Services

Start the Next.js application and Python ingestion service:

```bash
docker compose up -d
```

The `-d` flag runs containers in detached mode (background).

### Verify Services Are Running

Check container status:

```bash
docker compose ps
```

You should see:
- `mre-app` - Next.js application (port 3001)
- `mre-ingestion-service` - Python ingestion service (port 8000)

### View Logs

View application logs:

```bash
# All services
docker compose logs -f

# Next.js application only
docker logs -f mre-app

# Ingestion service only
docker logs -f mre-ingestion-service
```

### Access the Application

- **Local:** http://localhost:3001
- **Network:** http://0.0.0.0:3001

### Health Check

Verify the application is healthy:

```bash
curl http://localhost:3001/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-01-27T00:00:00.000Z"
}
```

### Stop Services

Stop all services:

```bash
docker compose down
```

Stop and remove volumes (clears database data):

```bash
docker compose down -v
```

---

## First-Time Developer Workflow

### 1. Run Database Migrations

If this is your first setup, run Prisma migrations:

```bash
# Enter the Next.js container
docker exec -it mre-app sh

# Run migrations
npx prisma migrate deploy

# Exit container
exit
```

Or run migrations locally (if Node.js is installed):

```bash
npx prisma migrate deploy
```

### 2. Seed the Database (Optional)

Seed the database with initial data:

```bash
# Inside container or locally
npx prisma db seed
```

### 3. Verify Database Connection

Check database connection:

```bash
docker exec -it mre-app sh
npx prisma studio
```

Prisma Studio will open in your browser at http://localhost:5555 (if port forwarding is configured).

### 4. Create Your First User

Register a user account:

```bash
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "dev@example.com",
    "password": "devPassword123",
    "driverName": "Developer Name",
    "teamName": "Dev Team"
  }'
```

### 5. Test Login

Test user authentication:

```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "dev@example.com",
    "password": "devPassword123"
  }'
```

### 6. Explore the Codebase

Familiarize yourself with the project structure:

- `src/app/` - Next.js App Router pages and API routes
- `src/core/` - Business logic (mobile-safe architecture)
- `src/components/` - React components
- `src/lib/` - Shared utilities and libraries
- `prisma/` - Database schema and migrations
- `ingestion/` - Python ingestion service
- `docs/` - Project documentation

---

## Running Tests

### Python Ingestion Service Tests

Run ingestion service tests (Docker - Recommended):

```bash
# Enter ingestion container
docker exec -it mre-ingestion-service sh

# Run tests
pytest

# Run with coverage
pytest --cov=ingestion

# Exit container
exit
```

Or run tests directly without entering the container:

```bash
# Run tests in container
docker exec -it mre-ingestion-service pytest

# Run with coverage
docker exec -it mre-ingestion-service pytest --cov=ingestion
```

**Note:** Local Python setup is optional. Docker execution is recommended for consistency.

### Next.js Application Tests

**Placeholder:** Frontend and backend tests for Next.js application are not yet implemented.

When tests are added:
- Unit tests: `npm test`
- Integration tests: `npm run test:integration`
- E2E tests: `npm run test:e2e`

See `docs/development/testing-strategy.md` for testing guidelines.

---

## Useful Development Commands

### Docker Commands

```bash
# Build images
docker compose build

# Start services
docker compose up -d

# Stop services
docker compose down

# View logs
docker compose logs -f

# Restart a service
docker compose restart app

# Rebuild and restart
docker compose up -d --build

# Execute command in container
docker exec -it mre-app sh
docker exec -it mre-ingestion-service sh

# View container resource usage
docker stats
```

### Database Commands

```bash
# Run migrations
docker exec -it mre-app npx prisma migrate deploy

# Generate Prisma client
docker exec -it mre-app npx prisma generate

# Open Prisma Studio (if port forwarding configured)
docker exec -it mre-app npx prisma studio

# Reset database (WARNING: deletes all data)
docker exec -it mre-app npx prisma migrate reset
```

### Development Scripts

```bash
# Run development server (if running locally)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

### Utility Scripts

The `scripts/` directory contains utility scripts for database operations and maintenance. All scripts must be executed inside the Docker container.

**Execution Pattern:**
```bash
docker exec -it mre-app npx ts-node --compiler-options '{"module":"commonjs"}' scripts/<script-name>.ts
```

**Available Scripts:**

- **list-users.ts** - List all users with email, driver name, team name, admin status, and creation date
- **list-tracks.ts** - List all tracks in the database with details
- **list-events.ts** - List events for a specific track (requires `--track-id` parameter)
- **check-db-data.ts** - Display overview of all database contents (users, tracks, events, races, etc.)
- **cleanup-events.ts** - Remove all events and related data. Use with `--force` flag to execute.
- **diagnose-auth.ts** - Diagnostic tool for troubleshooting authentication issues
- **normalize-emails.ts** - One-time migration to normalize all email addresses to lowercase
- **migrate-password.ts** - One-time migration script to convert bcryptjs password hashes to Argon2id

**Examples:**
```bash
# List all users
docker exec -it mre-app npx ts-node --compiler-options '{"module":"commonjs"}' scripts/list-users.ts

# List all tracks
docker exec -it mre-app npx ts-node --compiler-options '{"module":"commonjs"}' scripts/list-tracks.ts

# List events for a track
docker exec -it mre-app npx ts-node --compiler-options '{"module":"commonjs"}' scripts/list-events.ts --track-id <UUID>

# Check database contents
docker exec -it mre-app npx ts-node --compiler-options '{"module":"commonjs"}' scripts/check-db-data.ts

# Cleanup all events (shows what will be deleted)
docker exec -it mre-app npx ts-node --compiler-options '{"module":"commonjs"}' scripts/cleanup-events.ts

# Cleanup all events (executes deletion)
docker exec -it mre-app npx ts-node --compiler-options '{"module":"commonjs"}' scripts/cleanup-events.ts --force
```

### Ingestion Service Commands

#### Running Python CLI Commands (Docker - Recommended)

**All Python CLI commands should be run inside the Docker container.** This is the recommended and primary method:

```bash
# Ensure ingestion service is running
docker compose up -d ingestion-service

# List all tracks
docker exec -it mre-ingestion-service python -m ingestion.cli ingest liverc list-tracks

# Refresh tracks from LiveRC
docker exec -it mre-ingestion-service python -m ingestion.cli ingest liverc refresh-tracks

# List events for a track
docker exec -it mre-ingestion-service python -m ingestion.cli ingest liverc list-events --track-id <UUID>

# Refresh events for a track
docker exec -it mre-ingestion-service python -m ingestion.cli ingest liverc refresh-events --track-id <UUID>

# Ingest an event
docker exec -it mre-ingestion-service python -m ingestion.cli ingest liverc ingest-event --event-id <UUID>

# Check system status
docker exec -it mre-ingestion-service python -m ingestion.cli ingest liverc status

# Verify data integrity
docker exec -it mre-ingestion-service python -m ingestion.cli ingest liverc verify-integrity
```

**Why use Docker?**
- No local Python setup required (Python 3.11, dependencies, and Playwright pre-installed)
- Pre-configured database connection
- Consistent environment across all developers
- No virtual environment management needed

See `docs/operations/liverc-operations-guide.md` for complete CLI documentation.

#### Other Ingestion Service Operations

```bash
# View ingestion service logs
docker logs -f mre-ingestion-service

# Check ingestion service health
curl http://localhost:8000/health

# Trigger ingestion (via API)
curl -X POST http://localhost:3001/api/v1/events/[eventId]/ingest \
  -H "Content-Type: application/json" \
  -d '{"depth": "laps_full"}'
```

---

## Common Setup Issues

### Issue: Docker Network Not Found

**Error:** `network my-race-engineer_mre-network not found`

**Solution:**
```bash
docker network create my-race-engineer_mre-network
```

### Issue: PostgreSQL Container Not Found

**Error:** `could not translate host name "mre-postgres" to address`

**Solution:** Set up PostgreSQL container:

```bash
docker run -d \
  --name mre-postgres \
  --network my-race-engineer_mre-network \
  -e POSTGRES_USER=pacetracer \
  -e POSTGRES_PASSWORD=change-me \
  -e POSTGRES_DB=pacetracer \
  -p 5432:5432 \
  postgres:16
```

### Issue: Port Already in Use

**Error:** `port 3001 is already allocated`

**Solution:** Change port in `.env.docker`:
```bash
APP_PORT=3002  # Use different port
```

Or stop the service using the port:
```bash
# Find process using port
lsof -i :3001

# Kill process (replace PID)
kill -9 <PID>
```

### Issue: Database Connection Failed

**Error:** `Can't reach database server`

**Solutions:**
1. Verify PostgreSQL container is running:
   ```bash
   docker ps | grep mre-postgres
   ```

2. Check DATABASE_URL in `.env.docker`:
   ```bash
   # Should match container name and network
   DATABASE_URL=postgresql://pacetracer:change-me@mre-postgres:5432/pacetracer?schema=public
   ```

3. Test database connection:
   ```bash
   docker exec -it mre-postgres psql -U pacetracer -d pacetracer
   ```

### Issue: Prisma Client Not Generated

**Error:** `@prisma/client did not initialize yet`

**Solution:**
```bash
docker exec -it mre-app npx prisma generate
```

### Issue: Hot Reload Not Working

**Problem:** Code changes not reflected in running application

**Solutions:**
1. Verify volume mounts in `docker-compose.yml`:
   ```yaml
   volumes:
     - .:/app
     - /app/node_modules
     - /app/.next
   ```

2. Restart the container:
   ```bash
   docker compose restart app
   ```

3. Check file permissions (Linux/WSL):
   ```bash
   # Ensure files are readable
   chmod -R 755 .
   ```

### Issue: Ingestion Service Not Responding

**Error:** `Failed to connect to ingestion service`

**Solutions:**
1. Verify ingestion service is running:
   ```bash
   docker ps | grep ingestion-service
   ```

2. Check ingestion service logs:
   ```bash
   docker logs mre-ingestion-service
   ```

3. Test ingestion service health:
   ```bash
   curl http://localhost:8000/health
   ```

### Issue: Module Not Found Errors

**Error:** `Cannot find module '...'`

**Solutions:**
1. Rebuild Docker images:
   ```bash
   docker compose build --no-cache
   ```

2. Reinstall dependencies (inside container):
   ```bash
   docker exec -it mre-app npm install
   ```

---

## IDE/Editor Recommendations

### VS Code / Cursor

**Recommended Extensions:**
- **Prisma** - Prisma schema syntax highlighting
- **ESLint** - JavaScript/TypeScript linting
- **Prettier** - Code formatting
- **Docker** - Docker file support
- **Python** - Python support (for ingestion service)

**Settings (`.vscode/settings.json`):**
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

### Cursor-Specific

Cursor is recommended for AI-assisted development. It provides:
- AI code completion
- AI chat for code questions
- Context-aware suggestions

**Note:** Cursor uses the same extensions as VS Code.

---

## Next Steps

After completing setup:

1. **Read the Documentation**
   - [Architecture Guidelines](../architecture/mobile-safe-architecture-guidelines.md) - Core architecture rules
   - [API Reference](../api/api-reference.md) - API endpoints
   - [Database Schema](../database/schema.md) - Data model
   - [Contributing Guidelines](./CONTRIBUTING.md) - Development standards

2. **Explore the Codebase**
   - Start with `src/app/page.tsx` (home page)
   - Review `src/core/auth/` (authentication logic)
   - Check `src/app/api/v1/` (API routes)

3. **Understand the Architecture**
   - Mobile-safe architecture principles
   - Separation of UI and business logic
   - API-first design

4. **Join the Team**
   - Review role documentation in `docs/roles/`
   - Understand your role responsibilities
   - Familiarize yourself with handoff processes

5. **Start Developing**
   - Pick a small task or bug fix
   - Follow the contributing guidelines
   - Ask questions in team channels

---

## Related Documentation

- [README.md](../../README.md) - Project overview and basic setup
- [Environment Variables Reference](../operations/environment-variables.md) - Complete environment variable documentation
- [Docker Review Report](../reviews/DOCKER_REVIEW_REPORT.md) - Docker setup details
- [LiveRC Operations Guide](../operations/liverc-operations-guide.md) - Operational commands
- [Testing Strategy](./testing-strategy.md) - Testing guidelines
- [Contributing Guidelines](./CONTRIBUTING.md) - Development standards and workflow

---

**End of Quick Start Guide**

