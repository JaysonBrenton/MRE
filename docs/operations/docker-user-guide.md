---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description:
  Comprehensive Docker user guide for MRE application architecture and usage
purpose:
  Provides complete Docker architecture documentation, setup instructions, usage
  guide, development workflow, troubleshooting, and production considerations.
  This is the authoritative guide for understanding and working with the MRE
  Docker environment.
relatedFiles:
  - docker-compose.yml (container configuration)
  - Dockerfile (Next.js application build configuration)
  - ingestion/Dockerfile (Python ingestion service build configuration)
  - docs/reviews/DOCKER_REVIEW_REPORT.md (Docker review and evaluation)
  - docs/development/quick-start.md (developer onboarding)
  - docs/operations/deployment-guide.md (deployment procedures)
  - docs/operations/environment-variables.md (environment configuration)
---

# Docker User Guide for My Race Engineer (MRE)

**Document Type:** User Guide  
**Status:** Authoritative  
**Scope:** Docker architecture, setup, usage, development workflow,
troubleshooting, and production considerations

This guide provides comprehensive documentation for understanding and working
with the MRE Docker environment. It consolidates architecture details, setup
instructions, daily usage patterns, and troubleshooting procedures.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Initial Setup](#initial-setup)
5. [Daily Usage](#daily-usage)
6. [Development Workflow](#development-workflow)
7. [Container Details](#container-details)
8. [Network Architecture](#network-architecture)
9. [Volume Management](#volume-management)
10. [Environment Configuration](#environment-configuration)
11. [Troubleshooting](#troubleshooting)
12. [Production Considerations](#production-considerations)
13. [Reference](#reference)

---

## Overview

The MRE application runs as a containerized microservices architecture using
Docker Compose. The environment consists of:

- **Next.js Application** (`mre-app`) - Main web application and API server
- **Python Ingestion Service** (`mre-liverc-ingestion-service`) - LiveRC data
  ingestion microservice
- **PostgreSQL Database** (`mre-postgres`) - External database container
  (managed separately)

**Docker Runtime:** On macOS, **Colima is the required Docker runtime** for this
project. Docker Desktop must NOT be used. When troubleshooting Docker or
container issues (e.g. "too many open files", mount errors), restart Colima with
`colima stop && colima start` — never use Docker Desktop. See the
[Prerequisites](#prerequisites) section for setup instructions.

### Goals

The Docker setup provides:

- **Consistent Development Environment** - Same environment for all developers
- **Network Isolation** - Services communicate through isolated Docker network
- **Reproducible Behavior** - Eliminates machine-specific configuration issues
- **LLM-Safe** - Predictable environment for AI-assisted development
- **Hot Reload** - Development-friendly with live code updates
- **Production-Ready** - Multi-stage builds support both development and
  production

---

## Architecture

### Container Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Docker Network: mre-network                    │
│                                                              │
│  ┌──────────────┐      ┌──────────────┐                    │
│  │   mre-app    │      │  ingestion-  │                    │
│  │  (Next.js)   │      │   service    │                    │
│  │   Port 3001  │      │  (FastAPI)   │                    │
│  │              │      │   Port 8000  │                    │
│  └──────┬───────┘      └──────┬───────┘                    │
│         │                     │                             │
│         └──────────┬──────────┘                             │
│                    │                                        │
│         ┌──────────▼──────────┐                            │
│         │   mre-postgres      │                            │
│         │   (PostgreSQL 16)   │                            │
│         │   Port 5432         │                            │
│         └─────────────────────┘                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Service Overview

| Service           | Container Name                 | Port | Technology           | Purpose                        |
| ----------------- | ------------------------------ | ---- | -------------------- | ------------------------------ |
| Next.js App       | `mre-app`                      | 3001 | Node.js 20, Next.js  | Web application and API server |
| Ingestion Service | `mre-liverc-ingestion-service` | 8000 | Python 3.11, FastAPI | LiveRC data ingestion          |
| Database          | `mre-postgres`                 | 5432 | PostgreSQL 16        | Data persistence               |

### Network Architecture

All containers communicate through a Docker bridge network:

- **Network Name:** `my-race-engineer_mre-network`
- **Type:** External bridge network
- **Purpose:** Service discovery and inter-container communication
- **Persistence:** Network persists between container restarts

**Service Discovery:**

- Containers resolve each other by container name
- Example: `mre-app` connects to `mre-postgres` using hostname `mre-postgres`

---

## Prerequisites

### Required Software

You need a Docker runtime environment. **Colima is the required Docker runtime
for macOS.** Docker Desktop must NOT be used for this project.

#### Colima (Required for macOS)

- **Colima** - Lightweight Docker runtime for macOS
  - Installation: `brew install colima` (requires Homebrew)
  - Start with custom memory: `colima start --memory 14 --cpu 4`
  - Verify: `colima status`
  - **Benefits:** Command-line memory configuration, lighter than Docker
    Desktop, no GUI required, better resource control
  - **See:** [Colima Setup](#colima-setup) section below for complete setup
    instructions
  - **Helper Script:** Use `./scripts/start-colima.sh` to start with recommended
    settings

- **Docker** and **Docker Compose** (installed separately with Colima)
  - Verify: `docker --version` and `docker compose version`
  - **Note:** After installing Colima, ensure Docker context is set:
    `docker context use colima`

**Important:** Do not install or use Docker Desktop. This project uses Colima
exclusively. When troubleshooting (e.g. "too many open files"), restart Colima:
`colima stop && colima start`.

### System Requirements

- **Operating System:** macOS, Linux, or Windows (with WSL2)
- **RAM:** Minimum 8GB (16GB recommended)
- **Disk Space:** At least 5GB free space
- **CPU:** Multi-core processor recommended

### Optional but Recommended

- **Node.js** (version 20 or later) - For running scripts and Prisma CLI locally
- **Git** (version 2.30 or later) - For version control
- **VS Code** or **Cursor** - Recommended IDE with TypeScript support

---

## Colima Setup (macOS - Primary Docker Runtime)

**Colima is the recommended Docker runtime for macOS.** It provides better
control over resource allocation via command line and is lighter than Docker
Desktop. This section covers setup and configuration.

### Installation

```bash
# Install Colima via Homebrew
brew install colima

# Verify installation
colima --version
```

**Important:** If you're on Apple Silicon (M1/M2/M3), ensure you use the
ARM-native Homebrew installation at `/opt/homebrew/bin/brew`. If you have both
Intel and ARM Homebrew installed, use the ARM version:

```bash
/opt/homebrew/bin/brew install colima
```

### Starting Colima

Start Colima with your desired memory and CPU allocation:

```bash
# Start with 14GB RAM and 4 CPUs (adjust based on your system)
colima start --memory 14 --cpu 4

# Check status
colima status
```

**Recommended Settings:**

- **18GB system:** Use 14GB for Colima (leave 4GB for macOS)
- **16GB system:** Use 12GB for Colima (leave 4GB for macOS)
- **8GB system:** Use 4-6GB for Colima (leave 2-4GB for macOS)

### Switching Docker Context

After starting Colima, switch Docker to use it:

```bash
# Create Colima context (if not automatically created)
docker context create colima --docker "host=unix://$HOME/.colima/default/docker.sock" 2>/dev/null || true

# Switch to Colima
docker context use colima

# Verify Docker is using Colima
docker info | grep "Total Memory"
```

### Auto-Start Configuration

**Colima does NOT auto-start by default** after a system restart. To enable
auto-start:

#### Option 1: Manual Start (Recommended)

Start Colima manually when needed:

```bash
colima start --memory 14 --cpu 4
```

Or use the helper script:

```bash
./scripts/start-colima.sh
```

#### Option 2: Auto-Start with Login Script

Add to your `~/.zshrc` or `~/.bash_profile`:

```bash
# Auto-start Colima if not running
if ! colima status 2>/dev/null | grep -q "Running"; then
    /path/to/mre/scripts/start-colima.sh
fi
```

#### Option 3: Homebrew Services (Uses Default Settings)

**Note:** `brew services` will start Colima with default settings (not custom
memory/CPU):

```bash
# Enable auto-start (uses defaults - not recommended)
brew services start colima

# Disable auto-start
brew services stop colima
```

If you use Homebrew services, you'll need to stop and restart with custom
settings manually.

### Managing Colima

```bash
# Stop Colima
colima stop

# Start Colima with custom settings
colima start --memory 14 --cpu 4

# Or use helper script
./scripts/start-colima.sh

# Start with different settings
colima stop
colima start --memory 16 --cpu 6

# List Colima instances
colima list

# View Colima logs
colima logs

# Check if Colima is running
colima status
```

### Troubleshooting Colima

**Issue: Architecture mismatch error**

- **Solution:** Ensure you're using ARM-native Homebrew on Apple Silicon:
  `/opt/homebrew/bin/brew install colima`

**Issue: DNS resolution errors**

- **Solution:** Restart Colima:
  `colima stop && colima start --memory 14 --cpu 4`

**Issue: "too many open files" or mount errors (re-open fd, create mountpoint)**

- **Solution:** Restart Colima to clear file descriptor limits:
  `colima stop && colima start --memory 14 --cpu 4`
- **Never** use Docker Desktop (`open -a Docker`) — this project uses Colima only.

**Issue: Docker commands not working**

- **Solution:** Ensure Docker context is set: `docker context use colima`

---

## Initial Setup

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd mre
```

### Step 2: Create Docker Network

The application requires a Docker network. Create it if it doesn't exist:

```bash
# Check if network exists
docker network ls | grep my-race-engineer_mre-network

# Create network if it doesn't exist
docker network create my-race-engineer_mre-network
```

### Step 3: Set Up PostgreSQL Container

The application connects to an existing PostgreSQL container. Set it up if it
doesn't exist:

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

**Note:** The PostgreSQL container is managed separately from the compose file
to allow persistence across rebuilds.

### Step 4: Configure Environment Variables

Create a `.env.docker` file in the project root:

```bash
# Minimum required variables
DATABASE_URL=postgresql://pacetracer:change-me@mre-postgres:5432/pacetracer?schema=public
AUTH_SECRET=development-secret-change-in-production
NODE_ENV=development
POSTGRES_USER=pacetracer
POSTGRES_PASSWORD=change-me
POSTGRES_DB=pacetracer
APP_PORT=3001
INGESTION_PORT=8000
```

See `docs/operations/environment-variables.md` for complete environment variable
reference.

### Step 5: Build Docker Images

Build the application and ingestion service images:

```bash
docker compose build
```

This may take several minutes on first run as it:

- Downloads base images (Node.js 20, Python 3.11)
- Installs dependencies (npm packages, Python packages)
- Sets up Playwright browsers (for ingestion service)

### Step 6: Start Services

Start all services:

```bash
docker compose up -d
```

The `-d` flag runs containers in detached mode (background).

### Step 7: Verify Services

Check that all services are running:

```bash
docker compose ps
```

You should see:

- `mre-app` - Status: Up, Ports: 0.0.0.0:3001->3001/tcp
- `mre-liverc-ingestion-service` - Status: Up, Ports: 0.0.0.0:8000->8000/tcp

### Step 8: Run Database Migrations

On first setup, run Prisma migrations:

```bash
docker exec -it mre-app npx prisma migrate deploy
```

### Step 9: Verify Health

Check that services are healthy:

```bash
# Next.js application
curl http://localhost:3001/api/v1/health

# Ingestion service
curl http://localhost:8000/health
```

Expected responses:

```json
// Next.js app
{
  "status": "ok",
  "timestamp": "2025-01-27T00:00:00.000Z"
}

// Ingestion service
{
  "status": "healthy"
}
```

---

## Daily Usage

### Starting Services

```bash
# Start all services
docker compose up -d

# Start specific service
docker compose up -d app
docker compose up -d liverc-ingestion-service
```

### Stopping Services

```bash
# Stop all services (containers remain)
docker compose stop

# Stop and remove containers
docker compose down

# Stop, remove containers, and remove volumes (WARNING: deletes data)
docker compose down -v
```

### Viewing Logs

```bash
# All services (follow mode)
docker compose logs -f

# Specific service
docker logs -f mre-app
docker logs -f mre-liverc-ingestion-service

# Last 100 lines
docker logs --tail 100 mre-app

# Logs with timestamps
docker logs -f --timestamps mre-app
```

### Accessing Containers

```bash
# Enter Next.js container shell
docker exec -it mre-app sh

# Enter ingestion service container shell
docker exec -it mre-liverc-ingestion-service sh

# Run command in container
docker exec -it mre-app npx prisma studio
docker exec -it mre-app npm run lint
```

### Restarting Services

```bash
# Restart all services
docker compose restart

# Restart specific service
docker compose restart app
docker compose restart liverc-ingestion-service
```

### Rebuilding Services

```bash
# Rebuild all images
docker compose build

# Rebuild specific service
docker compose build app
docker compose build liverc-ingestion-service

# Rebuild without cache (clean build)
docker compose build --no-cache

# Rebuild and restart
docker compose up -d --build
```

### Checking Service Status

```bash
# Container status
docker compose ps

# Detailed container information
docker ps -a

# Container resource usage
docker stats

# Container health status
docker ps --format "table {{.Names}}\t{{.Status}}"
```

---

## Development Workflow

### Hot Reload

The development environment supports hot reload:

- **Next.js App:** Code changes automatically trigger rebuilds
- **Ingestion Service:** Code changes require container restart (or use volume
  mounts)

**Volume Mounts:**

- Source code is mounted as volumes for live updates
- `node_modules` and `.next` are excluded to use container versions

### Running Database Migrations

```bash
# Create new migration (if running locally)
npx prisma migrate dev --name migration_name

# Apply migrations (in container)
docker exec -it mre-app npx prisma migrate deploy

# Generate Prisma client
docker exec -it mre-app npx prisma generate

# Open Prisma Studio (database GUI)
docker exec -it mre-app npx prisma studio
```

### Running Python CLI Commands

**All Python CLI commands MUST be executed inside the Docker container.** This
is the primary and recommended method for running ingestion CLI commands.

**Why Docker?**

- **No local Python setup required** - Python 3.11, dependencies, and Playwright
  are pre-installed
- **Pre-configured environment** - Database connection and environment variables
  already set
- **Consistent environment** - Same Python version and dependencies for all
  developers
- **No virtual environment management** - Avoids Python version conflicts

**Prerequisites:**

- Ensure ingestion service is running:
  `docker compose up -d liverc-ingestion-service`

**Basic CLI Commands:**

```bash
# List all tracks
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc list-tracks

# Refresh tracks from LiveRC
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc refresh-tracks

# List events for a track
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc list-events --track-id <UUID>

# Refresh events for a track
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc refresh-events --track-id <UUID>

# Ingest an event
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc ingest-event --event-id <UUID>

# Check system status
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc status

# Verify data integrity
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc verify-integrity
```

**Command Format:**

```bash
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc <command> [options]
```

The `-it` flags enable interactive terminal mode with proper output formatting.

**Complete Documentation:** See `docs/operations/liverc-operations-guide.md` for
complete CLI command reference, examples, and workflows.

### Running Tests

**Python Ingestion Service:**

```bash
# Enter container
docker exec -it mre-liverc-ingestion-service sh

# Run tests
pytest

# Run with coverage
pytest --cov=ingestion

# Run specific test file
pytest tests/unit/test_validator.py
```

Or run tests directly without entering the container:

```bash
# Run tests in container
docker exec -it mre-liverc-ingestion-service pytest

# Run with coverage
docker exec -it mre-liverc-ingestion-service pytest --cov=ingestion
```

**Next.js Application:**

```bash
# Run linting
docker exec -it mre-app npm run lint

# Run type checking
docker exec -it mre-app npm run type-check
```

### Installing Dependencies

**Next.js App:**

The container's entrypoint script (`docker-entrypoint.sh`) automatically checks
and installs dependencies on startup. It verifies critical packages
(`@visx/group`, `react-window`, `react-redux`) are present and runs
`npm install --legacy-peer-deps` if needed.

**Manual Installation:**

```bash
# Install new package
docker exec -it mre-app npm install <package-name> --legacy-peer-deps

# Install all dependencies
docker exec -it mre-app npm install --legacy-peer-deps

# Rebuild container to persist changes (recommended for new packages)
docker compose build app
docker compose up -d app
```

**Note:** After adding a new package to `package.json`, rebuild the container to
ensure it's included in the Docker image's dependency layer. The entrypoint
script will handle installation on container start, but rebuilding ensures the
package is included in the image cache.

**Ingestion Service:**

```bash
# Add to requirements.txt, then rebuild
docker compose build liverc-ingestion-service
docker compose up -d liverc-ingestion-service
```

### Accessing the Application

- **Web Application:** http://localhost:3001
- **API Health Check:** http://localhost:3001/api/v1/health
- **Ingestion Service:** http://localhost:8000
- **Ingestion Health:** http://localhost:8000/health

---

## Container Details

### mre-app (Next.js Application)

**Image:** Built from `Dockerfile` (development target)  
**Container Name:** `mre-app`  
**Port:** 3001 (mapped to host)  
**Technology:** Node.js 20 (Alpine), Next.js

**Dockerfile Stages:**

1. **deps** - Install dependencies
2. **development** - Development environment with hot reload
3. **builder** - Production build
4. **production** - Production runtime

**Current Stage:** `development`

**Features:**

- Hot reload enabled
- Source code mounted as volume
- Node modules excluded from volume (uses container version)
- Health check configured
- Non-root user in production stage
- Automatic dependency checking via entrypoint script

**Entrypoint Script:** The container uses `docker-entrypoint.sh` to
automatically check and install dependencies on startup. The script:

- Verifies that `node_modules` exists and is up to date
- Checks if `package.json` or `package-lock.json` is newer than `node_modules`
- Verifies critical packages are present: `@visx/group`, `react-window`,
  `react-redux`
- Automatically runs `npm install --legacy-peer-deps` if dependencies are
  missing or outdated
- Regenerates Prisma client if the schema has changed

**Environment Variables:**

- `DATABASE_URL` - PostgreSQL connection string
- `NODE_ENV` - Environment (development/production)
- `PORT` - Application port (3001)
- `AUTH_SECRET` - NextAuth secret
- `APP_URL` - Application URL

**Health Check:**

```yaml
healthcheck:
  test:
    [
      "CMD",
      "wget",
      "--quiet",
      "--tries=1",
      "--spider",
      "http://localhost:3001/api/v1/health",
    ]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

### mre-liverc-ingestion-service (Python Ingestion Service)

**Image:** Built from `ingestion/Dockerfile`  
**Container Name:** `mre-liverc-ingestion-service`  
**Port:** 8000 (mapped to host)  
**Technology:** Python 3.11 (slim), FastAPI, Playwright

**Features:**

- FastAPI application
- Playwright for web scraping
- PostgreSQL client tools
- Non-root user for security
- Health check endpoint

**Environment Variables:**

- `DATABASE_URL` - PostgreSQL connection string
- `PYTHONUNBUFFERED` - Disable Python output buffering
- `LOG_LEVEL` - Logging level (INFO, DEBUG, etc.)
- `TZ` - Timezone
- `SITE_POLICY_PATH` - Path to site policy configuration file (default:
  `/app/policies/site_policy/policy.json`)

**Volume Mounts:**

- `./ingestion:/app/ingestion` - Source code for hot reload
- `./docs/reports:/app/docs/reports` - Persist sync reports
- `./policies:/app/policies:ro` - Site policy configuration (read-only, required
  for LiveRC discovery)

**Health Check:**

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

### mre-postgres (PostgreSQL Database)

**Image:** `postgres:16`  
**Container Name:** `mre-postgres`  
**Port:** 5432 (mapped to host)  
**Technology:** PostgreSQL 16

**Note:** This container is managed separately from docker-compose.yml to allow
persistence across rebuilds.

**Connection Details:**

- **Host:** `mre-postgres` (container name)
- **Port:** 5432
- **Database:** `pacetracer`
- **User:** `pacetracer`
- **Password:** `change-me` (configured in `.env.docker`)

**Connection String:**

```
postgresql://pacetracer:change-me@mre-postgres:5432/pacetracer?schema=public
```

---

## Network Architecture

### Network Configuration

**Network Name:** `my-race-engineer_mre-network`  
**Type:** Bridge network  
**Driver:** bridge  
**Scope:** External (created outside compose file)

### Service Communication

Containers communicate using Docker's built-in DNS:

- `mre-app` → `mre-postgres:5432` (database connection)
- `mre-app` → `mre-liverc-ingestion-service:8000` (API calls)
- `mre-liverc-ingestion-service` → `mre-postgres:5432` (database connection)

### Network Management

```bash
# List networks
docker network ls

# Inspect network
docker network inspect my-race-engineer_mre-network

# Create network (if needed)
docker network create my-race-engineer_mre-network

# Remove network (WARNING: stops all containers using it)
docker network rm my-race-engineer_mre-network
```

### Port Mapping

| Container                    | Container Port | Host Port           | Access                |
| ---------------------------- | -------------- | ------------------- | --------------------- |
| mre-app                      | 3001           | 3001 (configurable) | http://localhost:3001 |
| mre-liverc-ingestion-service | 8000           | 8000 (configurable) | http://localhost:8000 |
| mre-postgres                 | 5432           | 5432                | localhost:5432        |

**Configuration:** Port mappings are configured in `docker-compose.yml` and can
be overridden via environment variables (`APP_PORT`, `INGESTION_PORT`).

---

## Volume Management

### Volume Configuration

**Development Volumes:**

```yaml
# Next.js app
volumes:
  - .:/app                    # Mount source code
  - /app/node_modules         # Exclude node_modules
  - /app/.next                # Exclude .next build

# Ingestion service
volumes:
  - ./ingestion:/app/ingestion  # Mount source code
```

### Volume Benefits

- **Hot Reload:** Code changes reflect immediately
- **Development Speed:** No need to rebuild for code changes
- **IDE Integration:** Edit files locally, see changes in container

### Volume Limitations

- `node_modules` and `.next` are excluded to use container versions
- Ensures consistent dependencies across environments
- Prevents platform-specific binary issues

### Managing Volumes

```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect <volume-name>

# Remove unused volumes
docker volume prune

# Remove specific volume
docker volume rm <volume-name>
```

---

## Environment Configuration

### Environment Files

**Primary File:** `.env.docker`

This file contains all environment variables used by Docker Compose. It should
be:

- Created from `.env.docker.example` (if exists)
- Added to `.gitignore` (never commit secrets)
- Configured per developer/environment

### Key Environment Variables

**Database:**

- `DATABASE_URL` - Full PostgreSQL connection string
- `POSTGRES_USER` - Database user
- `POSTGRES_PASSWORD` - Database password
- `POSTGRES_DB` - Database name

**Application:**

- `NODE_ENV` - Environment (development/production)
- `PORT` - Application port (3001)
- `APP_PORT` - Host port mapping
- `APP_URL` - Application URL
- `AUTH_SECRET` - NextAuth secret

**Ingestion Service:**

- `INGESTION_PORT` - Host port mapping
- `LOG_LEVEL` - Logging level
- `TZ` - Timezone

### Environment Variable Precedence

1. Environment variables set in shell
2. Variables in `.env.docker` file
3. Default values in `docker-compose.yml`

### Complete Reference

See `docs/operations/environment-variables.md` for complete environment variable
documentation.

---

## Troubleshooting

### Common Issues

#### Issue: "too many open files" or Docker Mount Errors

**Error:** `reopen fd: too many open files` or similar when starting containers

**Solution:** This project uses Colima (not Docker Desktop). Restart Colima:

```bash
colima stop
colima start --memory 14 --cpu 4
```

Then start services: `docker compose up -d`. Never run `open -a Docker` or use
Docker Desktop.

#### Issue: Docker Network Not Found

**Error:** `network my-race-engineer_mre-network not found`

**Solution:**

```bash
docker network create my-race-engineer_mre-network
```

#### Issue: PostgreSQL Container Not Found

**Error:** `could not translate host name "mre-postgres" to address`

**Solution:**

```bash
# Check if container exists
docker ps -a | grep mre-postgres

# Create container if missing
docker run -d \
  --name mre-postgres \
  --network my-race-engineer_mre-network \
  -e POSTGRES_USER=pacetracer \
  -e POSTGRES_PASSWORD=change-me \
  -e POSTGRES_DB=pacetracer \
  -p 5432:5432 \
  postgres:16
```

#### Issue: Port Already in Use

**Error:** `port 3001 is already allocated`

**Solutions:**

1. **Change port in `.env.docker`:**

   ```bash
   APP_PORT=3002
   ```

2. **Find and stop process using port:**

   ```bash
   # macOS/Linux
   lsof -i :3001
   kill -9 <PID>

   # Windows
   netstat -ano | findstr :3001
   taskkill /PID <PID> /F
   ```

#### Issue: Database Connection Failed

**Error:** `Can't reach database server` or `Connection refused`

**Solutions:**

1. **Verify PostgreSQL container is running:**

   ```bash
   docker ps | grep mre-postgres
   ```

2. **Check DATABASE_URL in `.env.docker`:**

   ```bash
   # Should match container name and network
   DATABASE_URL=postgresql://pacetracer:change-me@mre-postgres:5432/pacetracer?schema=public
   ```

3. **Test database connection:**

   ```bash
   docker exec -it mre-postgres psql -U pacetracer -d pacetracer -c "SELECT 1"
   ```

4. **Check network connectivity:**
   ```bash
   docker exec -it mre-app ping mre-postgres
   ```

#### Issue: Prisma Client Not Generated

**Error:** `@prisma/client did not initialize yet`

**Solution:**

```bash
docker exec -it mre-app npx prisma generate
```

#### Issue: Hot Reload Not Working

**Problem:** Code changes not reflected in running application

**Solutions:**

1. **Verify volume mounts:**

   ```bash
   docker inspect mre-app | grep -A 10 Mounts
   ```

2. **Restart container:**

   ```bash
   docker compose restart app
   ```

3. **Check file permissions (Linux/WSL):**

   ```bash
   chmod -R 755 .
   ```

4. **Rebuild container:**
   ```bash
   docker compose up -d --build app
   ```

#### Issue: Ingestion Service Not Responding

**Error:** `Failed to connect to ingestion service`

**Solutions:**

1. **Verify service is running:**

   ```bash
   docker ps | grep liverc-ingestion-service
   ```

2. **Check service logs:**

   ```bash
   docker logs mre-liverc-ingestion-service
   ```

3. **Test health endpoint:**

   ```bash
   curl http://localhost:8000/health
   ```

4. **Restart service:**

   ```bash
   docker compose restart liverc-ingestion-service
   ```

5. **Verify site policy configuration is mounted:**

   ```bash
   # Check if policy file is accessible
   docker exec mre-liverc-ingestion-service ls -la /app/policies/site_policy/policy.json

   # If missing, recreate container to apply volume mount
   docker compose up -d --force-recreate liverc-ingestion-service
   ```

#### Issue: Module Not Found Errors

**Error:** `Cannot find module '...'`

**Solutions:**

1. **Restart container (entrypoint script will auto-install):**

   ```bash
   docker compose restart app
   ```

   The entrypoint script automatically checks for missing dependencies and
   installs them. It verifies critical packages (`@visx/group`, `react-window`,
   `react-redux`) are present.

2. **Rebuild images (if restart doesn't work):**

   ```bash
   docker compose build --no-cache app
   docker compose up -d app
   ```

3. **Manually reinstall dependencies:**

   ```bash
   docker exec -it mre-app npm install --legacy-peer-deps
   ```

4. **Check package.json:**

   ```bash
   docker exec -it mre-app cat package.json
   ```

5. **Verify critical packages exist:**
   ```bash
   docker exec mre-app test -d node_modules/react-redux && echo "react-redux installed" || echo "react-redux missing"
   docker exec mre-app test -d node_modules/@visx/group && echo "@visx/group installed" || echo "@visx/group missing"
   docker exec mre-app test -d node_modules/react-window && echo "react-window installed" || echo "react-window missing"
   ```

#### Issue: Container Won't Start

**Error:** Container exits immediately or won't start

**Solutions:**

1. **Check logs:**

   ```bash
   docker logs mre-app
   ```

2. **Check container status:**

   ```bash
   docker ps -a | grep mre-app
   ```

3. **Start in foreground to see errors:**

   ```bash
   docker compose up app
   ```

4. **Check health check:**
   ```bash
   docker inspect mre-app | grep -A 10 Health
   ```

#### Issue: Out of Disk Space

**Error:** `no space left on device`

**Solutions:**

1. **Clean up Docker resources:**

   ```bash
   # Remove unused containers
   docker container prune

   # Remove unused images
   docker image prune -a

   # Remove unused volumes
   docker volume prune

   # Remove build cache
   docker builder prune
   ```

2. **Check disk usage:**
   ```bash
   docker system df
   ```

---

## Production Considerations

### Production Build

The Dockerfile includes production stages:

```bash
# Build production image
docker build --target production -t mre-app:production .

# Run production container
docker run -d \
  --name mre-app-prod \
  -p 3001:3001 \
  -e NODE_ENV=production \
  -e DATABASE_URL=... \
  mre-app:production
```

### Production Differences

**Development:**

- Hot reload enabled
- Source code mounted as volumes
- Dev dependencies included
- Debug logging enabled

**Production:**

- Pre-built Next.js application
- No volume mounts
- Production dependencies only
- Optimized builds
- Non-root user
- Health checks configured

### Security Considerations

1. **Secrets Management:**
   - Never commit `.env.docker` to version control
   - Use secret management services in production
   - Rotate secrets regularly

2. **Non-Root User:**
   - Production images run as non-root user
   - Reduces security attack surface

3. **Network Isolation:**
   - Services communicate through isolated network
   - Database not exposed to host (unless needed)

4. **Resource Limits:**
   - Configure CPU and memory limits in production
   - Prevent resource exhaustion

### Scaling Considerations

**Horizontal Scaling:**

- Multiple app containers behind load balancer
- Shared database connection pool
- Stateless application design

**Vertical Scaling:**

- Increase container resources
- Optimize database queries
- Cache frequently accessed data

### Monitoring

**Health Checks:**

- Container health checks configured
- Application health endpoints available
- Monitor health status in production

**Logging:**

- Centralized logging solution recommended
- Structured logging format
- Log aggregation and analysis

**Metrics:**

- Container resource usage
- Application performance metrics
- Database connection pool metrics

See `docs/operations/observability-guide.md` for monitoring setup.

---

## Reference

### Quick Command Reference

```bash
# Start services
docker compose up -d

# Stop services
docker compose down

# View logs
docker compose logs -f

# Restart service
docker compose restart app

# Rebuild and restart
docker compose up -d --build

# Execute command in container
docker exec -it mre-app sh
docker exec -it mre-liverc-ingestion-service sh

# Run migrations
docker exec -it mre-app npx prisma migrate deploy

# Python CLI commands (ingestion service)
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc list-tracks
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc refresh-tracks
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc status

# Check health
curl http://localhost:3001/api/v1/health
curl http://localhost:8000/health

# View container status
docker compose ps

# View resource usage
docker stats
```

### File Locations

- **Docker Compose:** `docker-compose.yml`
- **Next.js Dockerfile:** `Dockerfile`
- **Next.js Entrypoint Script:** `docker-entrypoint.sh`
- **Ingestion Dockerfile:** `ingestion/Dockerfile`
- **Environment Variables:** `.env.docker`
- **Docker Review:** `docs/reviews/DOCKER_REVIEW_REPORT.md`

### Related Documentation

- [Docker Review Report](../reviews/DOCKER_REVIEW_REPORT.md) - Docker evaluation
  and review
- [Quick Start Guide](../development/quick-start.md) - Developer onboarding
- [Deployment Guide](./deployment-guide.md) - Deployment procedures
- [Environment Variables](./environment-variables.md) - Complete environment
  variable reference
- [LiveRC Operations Guide](./liverc-operations-guide.md) - Ingestion service
  operations

### Docker Compose File Structure

```yaml
services:
  app: # Next.js application
    build: ...
    ports: ...
    volumes: ...
    networks: ...
    healthcheck: ...

  liverc-ingestion-service: # Python ingestion service
    build: ...
    ports: ...
    volumes: ...
    networks: ...
    healthcheck: ...

networks:
  mre-network: # Shared network
    driver: bridge
    name: my-race-engineer_mre-network
```

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│              Docker Network: mre-network                    │
│                                                              │
│  ┌──────────────┐      ┌──────────────┐                    │
│  │   mre-app    │      │  ingestion-  │                    │
│  │  (Next.js)   │      │   service    │                    │
│  │   Port 3001  │      │  (FastAPI)   │                    │
│  │              │      │   Port 8000  │                    │
│  │  Volumes:    │      │              │                    │
│  │  - ./src     │      │  Volumes:    │                    │
│  │  - ./public  │      │  - ./ingestion│                  │
│  └──────┬───────┘      └──────┬───────┘                    │
│         │                     │                             │
│         └──────────┬──────────┘                             │
│                    │                                        │
│         ┌──────────▼──────────┐                            │
│         │   mre-postgres      │                            │
│         │   (PostgreSQL 16)   │                            │
│         │   Port 5432         │                            │
│         └─────────────────────┘                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Summary

This guide provides comprehensive documentation for the MRE Docker environment.
Key takeaways:

1. **Architecture:** Three-container setup (Next.js app, Python ingestion
   service, PostgreSQL database) on shared Docker network
2. **Development:** Hot reload enabled, source code mounted as volumes, easy
   debugging
3. **Production:** Multi-stage builds, optimized images, security best practices
4. **Operations:** Standard Docker Compose commands for daily operations
5. **Troubleshooting:** Common issues and solutions documented

For specific questions or advanced scenarios, refer to:

- Docker Review Report for architectural evaluation
- Deployment Guide for production deployment
- Environment Variables Guide for configuration details

---

**End of Docker User Guide**
