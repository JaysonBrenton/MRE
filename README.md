My Race Engineer (MRE) — Version 0.1.1 (Enterprise Architecture)

A Next.js application running in Docker, connected to PostgreSQL.

## ⚠️ CRITICAL: Docker-Only Environment

**IMPORTANT FOR ALL CONTRIBUTORS (INCLUDING LLMs):** This application runs
**EXCLUSIVELY in Docker containers**. There is no local development server. All
commands, dependency installations, and script executions must be performed
inside Docker containers. See `docs/AGENTS.md` Section 1 for complete Docker
environment guidelines.

**Key Points:**

- The application runs in Docker containers (`mre-app` for Next.js,
  `mre-liverc-ingestion-service` for Python)
- All npm/node commands must run inside the container:
  `docker exec -it mre-app <command>`
- All Python commands must run inside the container:
  `docker exec -it mre-liverc-ingestion-service <command>`
- Dependencies are automatically installed by the Docker entrypoint script when
  containers start
- Local `node_modules` is excluded from Docker volumes and not used by the
  running application

1. Purpose of This Repository

My Race Engineer (MRE) is an enterprise-grade RC racing telemetry platform. This
version is version 0.1.1, with an expanded feature set building on the
architectural foundation established in version 0.1.0.

This README is the single source of truth for:

Developers

LLM contributors

Architects and reviewers

It defines the version 0.1.1 feature scope, required documentation, architecture
rules, operational setup, and LLM guardrails.

2. Version 0.1.1 Feature Scope (Strict)

Only the following features are allowed in version 0.1.1. Anything not listed is
out of scope. The current build reflects the implemented subset; see
`docs/specs/mre-v0.1-feature-scope.md` for implementation status.

✔ 2.1 Registration

Fields:

Email or Username

Password

Driver Name (primary display name)

Team Name (optional)

Stored in PostgreSQL.

✔ 2.2 Login

Authenticated via Email/Username + Password. Sessions must follow the
architecture’s session/token framework.

✔ 2.3 User Welcome Page

After login, users see:

Welcome back <Driver Name>

✔ 2.4 Administrator Login

Admin accounts:

Cannot be created through the UI

Must be assigned via seed script, DB migration, or manual DB update

Redirect to Administration Console showing:

Welcome back <administrator-name>

✔ 2.5 LiveRC Ingestion

Track catalogue and discovery

Event discovery by track and date range

On-demand event data ingestion from LiveRC

Data storage for race events, drivers, results, and laps

See docs/architecture/liverc-ingestion/ for complete architecture specification.

-✔ 2.5.5 Telemetry Ingestion

- Upload telemetry files (GNSS, IMU) from devices
- Synthetic seed data and fixtures for development and testing
- Generator script for deterministic fixture generation from KML track templates
- See docs/telemetry/ for design, API contract, and seed data guide

✔ 2.6 Navigation, Tables, Dashboards, and Telemetry Visualizations

Version 0.1.1 includes expanded UI features:

**Navigation Features:**

- Breadcrumb navigation (primary pattern on many screens)
- Left navigation rail + top status bar after login; command palette for quick
  jumps (see `docs/user-guides/navigation.md`)
- Tab-based navigation within event analysis and similar pages

**Table Components:**

- Tables in admin console (users, events, tracks lists)
- Tables in event lists page
- Tables in driver management
- Tables in race results display
- Full sorting, filtering, and pagination support

**Dashboard System:**

- User dashboard (event selector + Event Analysis integration)
- Driver dashboard (performance metrics, lap times) _(future; redirects to
  under-development page)_
- Team dashboard (team statistics, member performance) _(future; redirects to
  under-development page)_
- Track dashboard (track-specific statistics) _(future; redirects to
  under-development page)_
- Customizable widgets (drag-and-drop, resize, rearrange) _(not implemented;
  dashboard focuses on event selection and Event Analysis integration)_

**Telemetry Visualizations:**

- Lap time charts (line graphs, comparisons)
- Speed graphs (over time, by sector)
- GPS track visualization (maps, track layouts)
- Sensor data visualization (throttle, brake, steering)
- Sector analysis (heatmaps, comparisons)

See docs/specs/mre-v0.1-feature-scope.md for complete feature specifications.

✔ 2.7 Out of Scope (Not Allowed in Version 0.1.1)

RC setup sheets

Race/session parsing (beyond existing LiveRC ingestion)

User profile editing

Import tools (beyond LiveRC ingestion)

Notifications, jobs, emails

Settings beyond dark mode

Any UI beyond registration, login, welcome pages, admin console, dashboards,
events, drivers

Python-based admin tools (future)

✔ 2.7 Dashboard and Event Pages

The following pages are in scope for version 0.1.1:

- Dashboard page (overview with navigation to event search)
- Events list page (browse imported events)
- Event Search page (search and import events from LiveRC)
- Event Analysis page (view and analyze event data with charts)
- Driver detail pages (view driver information and transponder overrides)
  _(currently redirect to `/under-development` until the driver detail UI is
  built)_

See docs/specs/mre-v0.1-feature-scope.md for complete feature specifications.

3. System Architecture Requirements

The entire application must follow:

docs/architecture/mobile-safe-architecture-guidelines.md

This governs:

API versioning (/api/v1/...)

Folder structure (src/core/...)

JSON contracts

Security rules

Testing expectations

Mobile constraints

Performance rules

Separation of UI + logic

The codebase must match the document. If not, code must be corrected or an ADR
created.

4. Theme System

See:

docs/design/mre-dark-theme-guidelines.md

Requirements:

Semantic tokens only (supports theme experimentation)

Dark theme is default, but theme system supports experimentation

No pure black backgrounds

AA contrast for all themes

Desktop-optimized layout

Consistent form and button styles

5. UX Principles

See:

docs/design/mre-ux-principles.md

Must follow:

Laws of UX

Consistency and predictable control placement

Clear validation and messaging

Cognitive load minimisation

6. Mobile UX Requirements

**Note:** The application is now desktop-only for UI. See
`docs/design/mre-ux-principles.md` for current UX guidelines. The mobile UX
guidelines document has been removed.

7. ADRs

Architecture decisions live in:

docs/adr/README.md

At least one ADR must exist before Beta.

8. Operational Documentation

See:

docs/operations/docker-user-guide.md (Docker architecture and usage guide)

docs/operations/build-runtime-reference.md (Compose services, ports, and
volumes)

docs/README.md (documentation index and navigation)

9. Role Documentation

The MRE project uses a role-based development approach where different
engineering roles have specific responsibilities and areas of ownership.

Role definitions and responsibilities are documented in:

docs/roles/

Key roles include:

- **DevOps & Platform Engineer**: Infrastructure, CI/CD, deployment automation
- **Documentation & Knowledge Steward**: Documentation quality, ADRs, knowledge
  management
- **Next.js Front-End Engineer**: UI components, App Router, design token usage
- **Observability & Incident Response Lead**: Logging, metrics, incident
  management
- **Prisma/PostgreSQL Backend Engineer**: Database schema, migrations, data
  persistence
- **Quality & Automation Engineer**: Testing, CI pipelines, quality gates
- **Senior UI/UX Expert**: UX principles, design systems, accessibility
- **TypeScript Domain Engineer**: Domain modeling, business logic, type safety

See individual role documents in `docs/roles/` for detailed responsibilities,
handoffs, and success metrics.

10. Directory Structure

```
.
├── README.md                      # This file (primary entry point)
├── docker-compose.yml             # app + ingestion + telemetry-worker + postgres + clickhouse
├── Dockerfile                     # Next.js app image
├── middleware.ts                  # Auth/route middleware
├── docs/                          # ALL product documentation (see docs/README.md)
│   ├── AGENTS.md                  # MRE Agents Handbook (guardrails)
│   ├── README.md                  # Curated documentation index
│   ├── index/document-index.md    # Full document listing
│   ├── specs/                     # Feature scope + under-development page spec
│   ├── architecture/              # Architecture standards
│   │   ├── mobile-safe-architecture-guidelines.md
│   │   └── liverc-ingestion/      # LiveRC ingestion architecture (31 documents)
│   ├── api/                       # API reference + versioning strategy
│   ├── database/                  # Human-readable schema docs
│   ├── domain/                    # Domain models (racing classes, bump-ups, etc.)
│   ├── design/                    # UX principles, dark theme, charts, tables
│   ├── development/               # Quick start, testing, contributing, checklists
│   ├── operations/                # Docker, deployment, env vars, runbooks
│   ├── telemetry/                 # Telemetry design + API contract + data model
│   ├── reference/generated/       # Machine-generated API/component manifests
│   ├── adr/                       # Architecture Decision Records
│   ├── roles/                     # Engineering role definitions
│   ├── standards/                 # File headers + TypeScript/React style guide
│   ├── user-guides/               # End-user guides (mirror /guides/* routes)
│   ├── user-stories/              # User stories by epic
│   ├── reviews/                   # Code/architecture reviews
│   └── reports/                   # Operational reports (track sync, etc.)
├── src/                           # Next.js application (TypeScript)
│   ├── app/                       # Next.js App Router
│   │   ├── (authenticated)/       # Authenticated route group (admin, eventAnalysis, guides, ...)
│   │   ├── api/v1/                # Versioned REST API routes
│   │   ├── login/                 # Login page
│   │   └── register/              # Registration page
│   ├── core/                      # Domain logic (auth, users, events, races, telemetry,
│   │                              #   tracks, track-maps, drivers, car-taxonomy, personas, ...)
│   ├── components/                # React components (atoms/molecules/organisms/templates)
│   ├── store/                     # Redux Toolkit store + slices + hooks
│   ├── hooks/                     # Shared React hooks
│   ├── lib/                       # Shared libraries and utilities
│   ├── types/                     # Shared TypeScript types
│   └── __tests__/                 # Vitest unit/integration tests
├── ingestion/                     # Python ingestion + telemetry service
│   ├── api/                       # FastAPI application + job queue
│   ├── cli/                       # Click-based admin CLI
│   ├── connectors/liverc/         # LiveRC connector + HTML parsers
│   ├── ingestion/                 # Ingestion pipeline, state machine, derived laps
│   ├── telemetry/                 # Telemetry pipeline + worker + parsers
│   ├── services/                  # Track sync + practice-day discovery
│   ├── db/                        # SQLAlchemy models + repository
│   ├── common/                    # Logging, metrics, tracing, site policy
│   ├── scripts/                   # Cron entrypoints + sync scripts
│   ├── crontab                    # Scheduled jobs (track sync, followed/recent events)
│   └── tests/                     # pytest unit + integration tests
├── prisma/                        # Database schema (schema.prisma) + migrations + seed
├── scripts/                       # TypeScript/shell utility scripts (run in Docker)
├── policies/                      # Shared site-policy (scraping throttle) config
├── certs/                         # Self-signed SSL certs (development only)
└── public/                        # Static assets
```

11. Utility Scripts

The `scripts/` directory contains 70+ TypeScript/shell/Python utility scripts
for database operations, diagnostics, and maintenance. All scripts must be
executed inside the Docker container. The list below highlights the most
commonly used scripts; browse `scripts/` for the full set (driver/event
diagnostics, speed tests, changelog/doc generators, Colima helpers, etc.).

**Running Scripts:**

```bash
docker exec -it mre-app npx ts-node --compiler-options '{"module":"commonjs"}' scripts/<script-name>.ts
```

**Available Scripts:**

- `check-db-data.ts` - Display overview of all database contents (users, tracks,
  events, races, etc.)
- `cleanup-events.ts` - Remove all events and related data (races, drivers,
  results, laps). Use with `--force` flag to execute.
- `diagnose-auth.ts` - Diagnostic tool for troubleshooting authentication and
  email lookup issues
- `list-events.ts` - List events for a specific track (requires `--track-id`
  parameter)
- `list-tracks.ts` - List all tracks in the database with details
- `list-users.ts` - List all users with email, driver name, team name, admin
  status, and creation date
- `migrate-password.ts` - One-time migration script to convert bcryptjs password
  hashes to Argon2id
- `normalize-emails.ts` - One-time migration to normalize all email addresses to
  lowercase

**Examples:**

```bash
# List all users
docker exec -it mre-app npx ts-node --compiler-options '{"module":"commonjs"}' scripts/list-users.ts

# List all tracks
docker exec -it mre-app npx ts-node --compiler-options '{"module":"commonjs"}' scripts/list-tracks.ts

# Check database contents
docker exec -it mre-app npx ts-node --compiler-options '{"module":"commonjs"}' scripts/check-db-data.ts

# Cleanup all events (dry run - shows what will be deleted)
docker exec -it mre-app npx ts-node --compiler-options '{"module":"commonjs"}' scripts/cleanup-events.ts

# Cleanup all events (executes deletion)
docker exec -it mre-app npx ts-node --compiler-options '{"module":"commonjs"}' scripts/cleanup-events.ts --force
```

12. LLM Usage Policy

LLMs must:

Enforce version 0.1.1 scope

Follow architecture + design docs

Use only /docs/ as authoritative

Quote documentation when validating behaviour

13. Docker & Environment Setup

MRE runs in Docker using PostgreSQL.

Prerequisites

**Docker Runtime:** On macOS, **Docker Desktop** is required (version 20.10 or
later): https://www.docker.com/products/docker-desktop. Ensure Docker Desktop is
running and the active context is `desktop-linux`
(`docker context use desktop-linux`). Colima is supported as an optional
alternative; see `docs/operations/docker-user-guide.md`.

**Docker Compose** (version 2.0 or later) - Included with Docker Desktop

**Docker network:** `my-race-engineer_mre-network` (external network - must be
created separately)

Create the network if it doesn't exist:

```bash
docker network create my-race-engineer_mre-network
```

**PostgreSQL Container:** The `mre-postgres` container must be created
separately (not managed by docker-compose). See
`docs/operations/docker-user-guide.md` Step 3 for setup instructions.

Start App

```bash
docker compose up -d
```

**For complete setup instructions, see:**

- `docs/operations/docker-user-guide.md` - Comprehensive Docker setup guide
- `docs/development/quick-start.md` - Developer onboarding guide

Logs docker logs -f mre-app

Access

Local: http://localhost:3001

Network: http://0.0.0.0:3001

Database Configuration

Host: mre-postgres

DB: pacetracer

User: pacetracer

Password: change-me (from .env.docker)

Connection:

postgresql://pacetracer:change-me@mre-postgres:5432/pacetracer?schema=public

Development Environment

Hot reloading

Source mounted as volume

Port 3001 exposed

Useful Docker Commands docker compose build docker compose up -d docker compose
down docker logs mre-app docker exec -it mre-app sh

Environment Variables (.env.docker)

DATABASE_URL

NODE_ENV

PORT

APP_URL

Python Ingestion Service

The MRE application includes a Python-based ingestion service that runs as a
separate microservice. This service handles LiveRC data ingestion, parsing, and
storage.

Service Details

Container: mre-liverc-ingestion-service

Port: 8000 (default, configurable via INGESTION_PORT)

Technology: FastAPI (Python 3.11+)

Purpose: Ingests race data from LiveRC, normalizes it, and stores it in the
PostgreSQL database

Integration: The Next.js application communicates with the ingestion service via
HTTP API calls. The ingestion service shares the same database connection as the
Next.js app.

Running CLI Commands

**All Python CLI commands MUST be executed inside the Docker container.** This
is the primary and recommended method:

```bash
# Ensure ingestion service is running
docker compose up -d liverc-ingestion-service

# Example: List tracks
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc list-tracks

# Example: Refresh tracks
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc refresh-tracks
```

**Why Docker?**

- No local Python setup required (Python 3.11, dependencies, Playwright
  pre-installed)
- Pre-configured database connection
- Consistent environment across developers

See ingestion/README.md for detailed setup, development, and API documentation.
See docs/operations/liverc-operations-guide.md for complete CLI command
reference.

**Telemetry seed data:** Generate synthetic telemetry fixtures from KML track
templates. See docs/telemetry/Design/Telemetry_Seed_Data_Guide.md. Example:

```bash
docker exec -it mre-liverc-ingestion-service python /app/ingestion/scripts/generate-telemetry-seed.py \
  --track /app/ingestion/tests/fixtures/telemetry/track-templates/cormcc.kml \
  --output /app/ingestion/tests/fixtures/telemetry/synth/pack-a/cormcc-clean-position-only \
  --laps 10 --seed 42
```

Fixtures live under ingestion/tests/fixtures/telemetry/.

**Speed test (event vs practice search):** Run indicative timings for event
search, practice search, event discover, and practice discover (see
docs/development/speed-test-search.md or script header):

```bash
docker exec -it mre-app npx tsx scripts/speed-test-search.ts [trackId]
```

Optional env: `TRACK_ID`, `START_DATE`, `END_DATE`, `YEAR`, `MONTH`. Default:
first active track, current month.

13.5 API Endpoints

The MRE application exposes the following API endpoints:

**Authentication Endpoints:**

- POST /api/v1/auth/register - Register a new user account
- POST /api/v1/auth/login - Authenticate and create session

**LiveRC Ingestion Endpoints:**

- GET /api/v1/tracks - Get track catalogue
- GET /api/v1/events - Get list of all fully imported events
- GET /api/v1/events/search - Search events by track and date range
- POST /api/v1/events/discover - Discover events from LiveRC for a track
- GET /api/v1/events/[eventId] - Get event details
- GET /api/v1/events/[eventId]/analysis - Get event analysis data
- GET /api/v1/events/[eventId]/summary - Get lightweight event summary data
- POST /api/v1/events/[eventId]/ingest - Trigger on-demand event ingestion
- POST /api/v1/events/ingest - Ingest event by source_event_id and track_id
- POST /api/v1/events/check-entry-lists - Check if driver name appears in entry
  lists

**Practice Days Endpoints:**

- GET /api/v1/practice-days/search - Search practice days in database by track
  and date range
- POST /api/v1/practice-days/discover - Discover practice days from LiveRC for a
  track and month
- POST /api/v1/practice-days/ingest - Ingest practice day data for a specific
  track and date

**Race Data Endpoints:**

- GET /api/v1/races/[raceId] - Get race details with results
- GET /api/v1/races/[raceId]/laps - Get lap data for all drivers in a race
- GET /api/v1/race-results/[raceResultId]/laps - Get lap data for a specific
  race result

**Driver Endpoints:**

- GET /api/v1/drivers/[driverId] - Get driver details with transponder numbers
  and event entries

**Transponder Override Endpoints:**

- POST /api/v1/transponder-overrides - Create transponder override
- GET /api/v1/transponder-overrides - List transponder overrides
- GET /api/v1/transponder-overrides/[overrideId] - Get transponder override
- PATCH /api/v1/transponder-overrides/[overrideId] - Update transponder override
- DELETE /api/v1/transponder-overrides/[overrideId] - Delete transponder
  override

**Personas Endpoints:**

- GET /api/v1/personas - Get available personas for current user
- GET /api/v1/personas/driver/events - Get events for driver persona
- GET /api/v1/personas/team-manager/team - Get team data for team manager
  persona
- GET /api/v1/users/me/persona - Get current user's active persona
- POST /api/v1/users/me/persona - Set current user's active persona (Race
  Engineer only)
- GET /api/v1/users/[userId]/driver-links - Get driver links for a user

**Admin Endpoints (Admin Only):**

- GET /api/v1/admin/stats - Get system statistics
- GET /api/v1/admin/health - Get detailed health check information
- POST /api/v1/admin/ingestion - Trigger ingestion jobs (track sync or event
  ingestion)
- GET /api/v1/admin/users - List all users
- PATCH /api/v1/admin/users/[userId] - Update user details
- DELETE /api/v1/admin/users/[userId] - Delete user
- GET /api/v1/admin/events - List all events with pagination and filtering
- DELETE /api/v1/admin/events/[eventId] - Delete event and all associated data
- POST /api/v1/admin/events/[eventId]/reingest - Trigger event re-ingestion
- GET /api/v1/admin/tracks - List all tracks
- PATCH /api/v1/admin/tracks/[trackId] - Update track (e.g., follow/unfollow)
- GET /api/v1/admin/audit - Get audit log entries
- GET /api/v1/admin/logs - Get application logs
- GET /api/v1/admin/logs/sources - Get available log sources

**Health Check:**

- GET /api/v1/health - Application health check

**Additional endpoint families:** The API also exposes telemetry
(`/api/v1/telemetry/sessions`, uploads, sharing, export, timeseries, map,
quality), track maps (`/api/v1/track-maps`, sharing), car/driver profiles
(`/api/v1/car-profiles`, `/api/v1/driver-profiles`), car taxonomy
(`/api/v1/car-taxonomy`, `/api/v1/user/car-taxonomy-rules`), leaderboards
(`/api/v1/leaderboards/...`), practice-day discovery
(`/api/v1/practice-days/...`), user driver-links and host-track overrides, and
async job status (`/api/v1/ingestion/jobs/[jobId]`,
`/api/v1/admin/track-sync/jobs/[jobId]`). The above list is a curated subset;
the canonical, machine-generated route inventory is
`docs/reference/generated/api-routes.manifest.json` and full documentation is in
`docs/api/api-reference.md`.

**Note:** All data endpoints require authentication. Admin endpoints require
admin privileges (`isAdmin: true`). Rate limiting is applied to authentication
and ingestion endpoints.

All API endpoints follow the standard response format defined in
docs/architecture/mobile-safe-architecture-guidelines.md Section 3.2. See
docs/api/api-reference.md for complete API documentation.

14. Contributing

Before contributing:

Read the version 0.1.1 scope

Follow architecture guidelines

Follow UX + design documents

Match documented patterns

Create ADRs for deviations

15. Product Vision (Future Releases) 15.1 Landing Page Navigation (Future)

Future navigation includes:

Home

Telemetry

Analytics

LiveRC Integration

Setup Sheets

AI Coach

Pricing

Blog

Login / Register

All out-of-scope links must route to:

/under-development

15.2 Under Development Message We're still building this feature, the pit crew
is working on it!

15.3 Hero Message

Drive faster, think clearer. Let MRE reveal where you’re gaining and losing
time, lap-by-lap.

15.4 Hero Image Design

Defined in:

docs/design/mre-hero-image-generation.md

16. License

Internal use only.
