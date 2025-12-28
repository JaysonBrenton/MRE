My Race Engineer (MRE) — Version 0.1.1 (Enterprise Architecture)

A Next.js application running in Docker, connected to PostgreSQL.

1. Purpose of This Repository

My Race Engineer (MRE) is an enterprise-grade RC racing telemetry platform.
This version is version 0.1.1, with an expanded feature set building on the architectural foundation established in version 0.1.0.

This README is the single source of truth for:

Developers

LLM contributors

Architects and reviewers

It defines the version 0.1.1 feature scope, required documentation, architecture rules, operational setup, and LLM guardrails.

2. Version 0.1.1 Feature Scope (Strict)

Only the following features are allowed in version 0.1.1.
Anything not listed is out of scope.

✔ 2.1 Registration

Fields:

Email or Username

Password

Driver Name (primary display name)

Team Name (optional)

Stored in PostgreSQL.

✔ 2.2 Login

Authenticated via Email/Username + Password.
Sessions must follow the architecture’s session/token framework.

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

✔ 2.6 Navigation, Tables, Dashboards, and Telemetry Visualizations

Version 0.1.1 includes expanded UI features:

**Navigation Features:**
- Breadcrumb navigation (primary pattern)
- Simplified hamburger menus (basic toggle functionality)
- Multi-level dropdown menus (secondary pattern)
- Tab-based navigation (secondary pattern)

**Table Components:**
- Tables in admin console (users, events, tracks lists)
- Tables in event lists page
- Tables in driver management
- Tables in race results display
- Full sorting, filtering, and pagination support

**Dashboard System:**
- User dashboard (personal stats, recent events)
- Driver dashboard (performance metrics, lap times)
- Team dashboard (team statistics, member performance)
- Track dashboard (track-specific statistics)
- Customizable widgets (drag-and-drop, resize, rearrange)

**Telemetry Visualizations:**
- Lap time charts (line graphs, comparisons)
- Speed graphs (over time, by sector)
- GPS track visualization (maps, track layouts)
- Sensor data visualization (throttle, brake, steering)
- Sector analysis (heatmaps, comparisons)

See docs/specs/mre-v0.1-feature-scope.md for complete feature specifications.

✔ 2.7 Out of Scope (Not Allowed in Version 0.1.1)

Telemetry data ingestion (sensor data collection)

RC setup sheets

Race/session parsing (beyond existing LiveRC ingestion)

User profile editing

Import tools (beyond LiveRC ingestion)

Notifications, jobs, emails

Settings beyond dark mode

Any UI beyond registration, login, welcome pages, admin console, dashboards, events, drivers

Python-based admin tools (future)

✔ 2.7 Dashboard and Event Pages

The following pages are in scope for version 0.1.1:
- Dashboard page (overview with navigation to event search)
- Events list page (browse imported events)
- Event Search page (search and import events from LiveRC)
- Event Analysis page (view and analyze event data with charts)
- Driver detail pages (view driver information and transponder overrides)

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

The codebase must match the document.
If not, code must be corrected or an ADR created.

4. Dark Theme Standard

See:

docs/design/mre-dark-theme-guidelines.md

Requirements:

Semantic tokens only

No pure black backgrounds

AA contrast

Mobile-first layout

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

See:

docs/design/mre-mobile-ux-guidelines.md

Version 0.1.1 screens must:

Function fully on mobile

Avoid hover-only interactions

Use proper touch targets

Collapse correctly on small screens

7. ADRs

Architecture decisions live in:

docs/adr/README.md

At least one ADR must exist before Beta.

8. Operational Documentation

See:

docs/operations/docker-user-guide.md (Docker architecture and usage guide)

docs/reviews/DOCKER_REVIEW_REPORT.md (Docker review and evaluation)

9. Role Documentation

The MRE project uses a role-based development approach where different engineering roles have specific responsibilities and areas of ownership.

Role definitions and responsibilities are documented in:

docs/roles/

Key roles include:

- **DevOps & Platform Engineer**: Infrastructure, CI/CD, deployment automation
- **Documentation & Knowledge Steward**: Documentation quality, ADRs, knowledge management
- **Next.js Front-End Engineer**: UI components, App Router, design token usage
- **Observability & Incident Response Lead**: Logging, metrics, incident management
- **Prisma/PostgreSQL Backend Engineer**: Database schema, migrations, data persistence
- **Quality & Automation Engineer**: Testing, CI pipelines, quality gates
- **Senior UI/UX Expert**: UX principles, design systems, accessibility
- **TypeScript Domain Engineer**: Domain modeling, business logic, type safety

See individual role documents in `docs/roles/` for detailed responsibilities, handoffs, and success metrics.

10. Directory Structure
.
├── README.md
├── docs/
│   ├── specs/
│   │   ├── mre-v0.1-feature-scope.md
│   │   └── mre-under-development-page.md
│   ├── architecture/
│   │   ├── mobile-safe-architecture-guidelines.md
│   │   └── liverc-ingestion/     # LiveRC ingestion architecture (26 documents)
│   ├── design/
│   │   ├── mre-dark-theme-guidelines.md
│   │   ├── mre-hero-image-generation.md
│   │   ├── mre-mobile-ux-guidelines.md
│   │   └── mre-ux-principles.md
│   ├── adr/
│   │   ├── README.md
│   │   └── ADR-*.md (Architecture Decision Records)
│   ├── reviews/
│   │   └── DOCKER_REVIEW_REPORT.md
│   ├── roles/
│   │   ├── devops-platform-engineer.md
│   │   ├── documentation-knowledge-steward.md
│   │   ├── nextjs-front-end-engineer.md
│   │   ├── observability-incident-response-lead.md
│   │   ├── prisma-postgresql-backend-engineer.md
│   │   ├── quality-automation-engineer.md
│   │   ├── senior-ui-ux-expert.md
│   │   └── typescript-domain-engineer.md
│   └── standards/
│       └── file-headers-and-commenting-guidelines.md
├── src/
│   ├── core/
│   │   ├── auth/          # Authentication business logic
│   │   ├── users/         # User domain logic
│   │   └── common/        # Shared utilities
│   ├── app/               # Next.js App Router
│   │   ├── api/           # API routes
│   │   │   └── v1/        # Versioned API endpoints
│   │   ├── admin/         # Admin pages
│   │   ├── login/         # Login page
│   │   ├── register/      # Registration page
│   │   ├── welcome/       # User welcome page
│   │   └── under-development/  # Placeholder page
│   ├── components/        # React components (shared)
│   └── lib/               # Shared libraries and utilities
├── components/            # React components (root level, legacy)
├── ingestion/             # Python ingestion service
│   ├── api/               # FastAPI application
│   ├── connectors/        # Data source connectors (LiveRC)
│   ├── db/                # Database models and repository
│   └── ingestion/         # Ingestion pipeline logic
├── prisma/                # Database schema and migrations
├── scripts/               # Utility scripts for database operations
│   ├── check-db-data.ts      # Display database contents overview
│   ├── cleanup-events.ts     # Remove all events and related data
│   ├── diagnose-auth.ts      # Diagnostic tool for authentication issues
│   ├── list-events.ts        # List events for a specific track
│   ├── list-tracks.ts        # List all tracks in the database
│   ├── list-users.ts         # List all users in the database
│   ├── migrate-password.ts   # Migrate passwords from bcryptjs to Argon2id
│   └── normalize-emails.ts   # Normalize all email addresses to lowercase
└── public/                # Static assets

11. Utility Scripts

The `scripts/` directory contains TypeScript utility scripts for database operations and maintenance. All scripts must be executed inside the Docker container.

**Running Scripts:**
```bash
docker exec -it mre-app npx ts-node --compiler-options '{"module":"commonjs"}' scripts/<script-name>.ts
```

**Available Scripts:**
- `check-db-data.ts` - Display overview of all database contents (users, tracks, events, races, etc.)
- `cleanup-events.ts` - Remove all events and related data (races, drivers, results, laps). Use with `--force` flag to execute.
- `diagnose-auth.ts` - Diagnostic tool for troubleshooting authentication and email lookup issues
- `list-events.ts` - List events for a specific track (requires `--track-id` parameter)
- `list-tracks.ts` - List all tracks in the database with details
- `list-users.ts` - List all users with email, driver name, team name, admin status, and creation date
- `migrate-password.ts` - One-time migration script to convert bcryptjs password hashes to Argon2id
- `normalize-emails.ts` - One-time migration to normalize all email addresses to lowercase

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

Docker + Docker Compose

Docker network: my-race-engineer_mre-network

If the network doesn't exist, create it:
```bash
docker network create my-race-engineer_mre-network
```

Existing mre-postgres container on my-race-engineer_mre-network

Start App
docker compose up -d

Logs
docker logs -f mre-app

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

Useful Docker Commands
docker compose build
docker compose up -d
docker compose down
docker logs mre-app
docker exec -it mre-app sh

Environment Variables (.env.docker)

DATABASE_URL

NODE_ENV

PORT

APP_URL

Python Ingestion Service

The MRE application includes a Python-based ingestion service that runs as a separate microservice. This service handles LiveRC data ingestion, parsing, and storage.

Service Details

Container: mre-ingestion-service

Port: 8000 (default, configurable via INGESTION_PORT)

Technology: FastAPI (Python 3.11+)

Purpose: Ingests race data from LiveRC, normalizes it, and stores it in the PostgreSQL database

Integration: The Next.js application communicates with the ingestion service via HTTP API calls. The ingestion service shares the same database connection as the Next.js app.

Running CLI Commands

**All Python CLI commands MUST be executed inside the Docker container.** This is the primary and recommended method:

```bash
# Ensure ingestion service is running
docker compose up -d ingestion-service

# Example: List tracks
docker exec -it mre-ingestion-service python -m ingestion.cli ingest liverc list-tracks

# Example: Refresh tracks
docker exec -it mre-ingestion-service python -m ingestion.cli ingest liverc refresh-tracks
```

**Why Docker?**
- No local Python setup required (Python 3.11, dependencies, Playwright pre-installed)
- Pre-configured database connection
- Consistent environment across developers

See ingestion/README.md for detailed setup, development, and API documentation.
See docs/operations/liverc-operations-guide.md for complete CLI command reference.

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
- POST /api/v1/events/[eventId]/ingest - Trigger on-demand event ingestion
- POST /api/v1/events/ingest - Ingest event by source_event_id and track_id

**Race Data Endpoints:**
- GET /api/v1/races/[raceId] - Get race details with results
- GET /api/v1/races/[raceId]/laps - Get lap data for all drivers in a race
- GET /api/v1/race-results/[raceResultId]/laps - Get lap data for a specific race result

**Driver Endpoints:**
- GET /api/v1/drivers/[driverId] - Get driver details with transponder numbers and event entries

**Transponder Override Endpoints:**
- POST /api/v1/transponder-overrides - Create transponder override
- GET /api/v1/transponder-overrides - List transponder overrides
- GET /api/v1/transponder-overrides/[overrideId] - Get transponder override
- PATCH /api/v1/transponder-overrides/[overrideId] - Update transponder override
- DELETE /api/v1/transponder-overrides/[overrideId] - Delete transponder override

**Health Check:**
- GET /api/health - Application health check

**Note:** All data endpoints require authentication. Rate limiting is applied to authentication and ingestion endpoints.

All API endpoints follow the standard response format defined in docs/architecture/mobile-safe-architecture-guidelines.md Section 3.2. See docs/api/api-reference.md for complete API documentation.

14. Contributing

Before contributing:

Read the version 0.1.1 scope

Follow architecture guidelines

Follow UX + design documents

Match documented patterns

Create ADRs for deviations

15. Product Vision (Future Releases)
15.1 Landing Page Navigation (Future)

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

15.2 Under Development Message
We're still building this feature, the pit crew is working on it!

15.3 Hero Message

Drive faster, think clearer.
Let MRE reveal where you’re gaining and losing time, lap-by-lap.

15.4 Hero Image Design

Defined in:

docs/design/mre-hero-image-generation.md

16. License

Internal use only.
