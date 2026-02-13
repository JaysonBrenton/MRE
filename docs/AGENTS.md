---
created: 2025-12-23
owner: Architecture & Enablement
purpose:
  Describe all autonomous / semi-autonomous contributors (human or LLM) that
  operate inside the MRE repo and the guardrails they must obey.
relatedDocs:
  - README.md
  - docs/specs/mre-v0.1-feature-scope.md
  - docs/architecture/
  - docs/operations/
  - docs/roles/
---

# MRE Agents Handbook

This repository is intentionally built for multi-agent collaboration (human
specialists + LLM assistants). Every contributor must understand the agents in
play, their domains, and the guardrails defined by the version 0.1.1 program.

## 1. Global Guardrails (Apply to All Agents)

### ⚠️ CRITICAL: Docker-Only Environment

**THE APPLICATION ONLY RUNS IN DOCKER. NEVER ASSUME A LOCAL DEVELOPMENT
ENVIRONMENT.**

- **Docker is Required** – The MRE application runs exclusively in Docker
  containers. There is no local development server. The application is accessed
  via Docker containers (`mre-app` for Next.js, `mre-liverc-ingestion-service`
  for Python ingestion).
  - **Docker Runtime:** On macOS, **Colima is the recommended and primary Docker
    runtime** (see `docs/operations/docker-user-guide.md` for Colima setup).
    Colima provides command-line memory configuration, is lighter than Docker
    Desktop, and offers better resource control. Docker Desktop is supported as
    an alternative option.
- **All Commands Run in Docker** – When suggesting commands, always prefix with
  `docker exec -it mre-app` (for Next.js) or
  `docker exec -it mre-liverc-ingestion-service` (for Python). Never suggest
  running `npm install`, `npm run dev`, `pytest`, or similar commands directly
  on the host unless explicitly for updating `package.json` or
  `package-lock.json`.
- **Dependencies Install in Container** – When dependencies are missing or need
  updating:
  - The Docker entrypoint script (`docker-entrypoint.sh`) automatically installs
    dependencies when the container starts if `package.json` or
    `package-lock.json` is newer than `node_modules`.
  - To manually trigger:
    `docker exec -it mre-app npm install --legacy-peer-deps` (inside container)
  - To rebuild: `docker compose build` or `docker compose up -d --build`
- **Local node_modules is Not Used** – The host's `node_modules` directory is
  excluded from Docker volumes. The container has its own isolated
  `node_modules`. Changes to local `node_modules` do not affect the running
  application.
- **Port 3001 is Docker** – If port 3001 is in use, it's the Docker container,
  not a local process. Check with `docker ps` to see running containers.
- **Scripts Run in Container** – All utility scripts in `scripts/` must be
  executed inside the Docker container:
  `docker exec -it mre-app npx ts-node --compiler-options '{"module":"commonjs"}' scripts/<script-name>.ts`
- **Python Commands Run in Container** – All Python CLI commands must run in the
  ingestion container:
  `docker exec -it mre-liverc-ingestion-service python -m ingestion.cli <command>`

**When troubleshooting build or runtime errors:**

1. First check if dependencies are installed in the container:
   `docker exec mre-app ls node_modules | grep <package-name>`
2. Restart the container to trigger automatic dependency installation:
   `docker compose restart app`
3. If needed, rebuild the image: `docker compose build app`

### Other Global Guardrails

- **Version 0.1.1 Scope Only** – Follow the feature list in `README.md` and
  `docs/specs/mre-v0.1-feature-scope.md#6-llm-guardrails`. Reject any change
  outside registration, login, welcome/admin pages, LiveRC ingestion, navigation
  features, table components, dashboard systems, and telemetry visualizations.
- **Docs Are Canon** – Architecture, ops, security, and UX documents under
  `docs/` outrank code comments. Quote them when defending design decisions.
- **All Documentation in `docs/`** – **ALL documentation files must live under
  `docs/`**. This includes reports, reviews, ADRs, architecture docs, operations
  guides, and any other documentation. The only exception is `README.md` at the
  root, which serves as the entry point. Any documentation found outside `docs/`
  must be moved there.
- **Folder Contracts** – Next.js logic lives under `src/`, Python ingestion
  under `ingestion/`, and all knowledge artifacts under `docs/`. Do not
  cross-contaminate.
- **Structured Logging + Metrics** – The ingestion service must emit structlog
  JSON plus Prometheus metrics (`ingestion/common/logging.py`,
  `ingestion/common/metrics.py`). Never add plain `print` debugging in
  production code.
- **CI Expectations** – Tests live under `src/__tests__` and `ingestion/tests`.
  Prefer fixture-backed, deterministic tests per
  `docs/architecture/liverc-ingestion/18-ingestion-testing-strategy.md`.

## 2. Agents and Their Domains

### 2.1 Frontend Delivery Agent (Next.js + TypeScript)

- **Scope**: All UI, API routes, and domain logic inside the Next.js app
  (`src/app`, `src/core`, `src/api`).
- **Primary References**:
  `docs/architecture/mobile-safe-architecture-guidelines.md`,
  `docs/architecture/atomic-design-system.md`,
  `docs/design/mre-dark-theme-guidelines.md`,
  `docs/design/mre-mobile-ux-guidelines.md`.
  For shared or persisted UI state: `docs/architecture/search-feature.md`,
  `src/store/` (slices and hooks).
- **Rules**:
  - Never access Prisma directly from React components; use
    `src/core/.../repo.ts` per architecture rules.
  - Follow the theme system guidelines (dark theme is default, but
    experimentation is encouraged) and mobile UX constraints noted in the
    README.
  - **Atomic design:** When adding or changing UI components, follow
    `docs/architecture/atomic-design-system.md`: use canonical molecules (e.g.
    Tooltip, Modal) from Key Component Paths; respect tier and import rules; use
    `@/components/` paths.
  - **Redux:** For cross-component or persisted UI state (e.g. dashboard
    selection, search state, UI preferences), use the Redux store in
    `src/store/`: use existing slices and hooks from `src/store/hooks.ts`; add
    new slices only when needed and follow the same patterns.
  - Tests for UI logic belong in `src/__tests__` and must mirror the documented
    behaviours.
  - **⚠️ CRITICAL: Flexbox Horizontal Compression** - When creating scrollable
    flex layouts (e.g., "form fixed, results scroll"), you **MUST** add inline
    `style={{ minWidth: '20rem', width: '100%', boxSizing: 'border-box' }}` to
    **all content blocks** (empty states, messages, etc.), not just containers.
    See `docs/development/FLEXBOX_LAYOUT_CHECKLIST.md` section "Content Blocks
    in Scrollable Flex Containers". This is the #1 recurring layout bug - always
    check this checklist when adding flex + scroll layouts.

### 2.2 LiveRC Ingestion Agent (Python Service)

- **Scope**: Python microservice under `ingestion/` handling track/event
  discovery, ingestion pipeline, and CLI.
- **Key Components**:
  - Connector + parsers (`ingestion/connectors/liverc/`)
  - Pipeline orchestrator (`ingestion/ingestion/pipeline.py`)
  - Repository (SQLAlchemy) layer (`ingestion/db/repository.py`)
  - CLI commands + cron wrappers (`ingestion/cli/commands.py`,
    `ingestion/scripts/*.sh`, `ingestion/crontab`)
- **Guardrails**:
  - Follow the HTTPX→Playwright fallback decision tree defined in
    `docs/architecture/liverc-ingestion/02-connector-architecture.md`.
  - Maintain idempotency and locking semantics from
    `docs/architecture/liverc-ingestion/03-ingestion-pipeline.md` and the
    implementation of advisory locks.
  - Observability: log via structlog, emit Prometheus metrics
    (`ingestion/common/metrics.py`), and keep tracing breadcrumbs
    (`ingestion/common/tracing.py`).
  - Ops: automated cron workflows include track sync and followed-track event
    refresh (`ingestion/scripts/run-track-sync.sh`,
    `ingestion/scripts/run-followed-event-sync.sh`). Cron timing is documented
    in `docs/operations/liverc-operations-guide.md`.

### 2.3 DevOps / Platform Agent

- **Scope**: Docker images, orchestration scripts, and environment bootstrapping
  (see `Dockerfile`, `docker-compose.yml`, `dc/`,
  `docs/operations/docker-user-guide.md`).
- **Tasks**:
  - Keep container entrypoints in sync with cron scripts.
  - Ensure Playwright dependencies exist in the ingestion container (per
    `ingestion/requirements.txt`).
  - Maintain the `docs/reports/` artefacts produced by CLI jobs.

### 2.4 Documentation & Knowledge Agent

- **Scope**: Entire `docs/` tree plus repo root knowledge artefacts (`README.md`
  only - all other documentation must be in `docs/`).
- **Responsibilities**:
  - Ensure ALL documentation lives under `docs/` (reports, reviews, ADRs,
    architecture docs, operations guides, etc.).
  - Update ADRs when architectural changes occur (`docs/adr/`).
  - Keep review documents under `docs/reviews/` in sync with actual
    implementation changes.
  - Uphold role definitions under `docs/roles/` so that other agents know who
    owns which layer.

### 2.5 Quality & Observability Agent

- **Scope**: Testing strategies (`ingestion/tests`, `src/__tests__`),
  monitoring, and incident response.
- **References**:
  - `docs/architecture/liverc-ingestion/18-ingestion-testing-strategy.md`
  - `docs/architecture/liverc-ingestion/15-ingestion-observability.md`
  - `docs/roles/quality-automation-engineer.md`
  - `docs/roles/observability-incident-response-lead.md`
- **Expectations**:
  - Maintain fixture parity with upstream LiveRC HTML under
    `ingestion/tests/fixtures/liverc/`.
  - Telemetry fixtures live under `ingestion/tests/fixtures/telemetry/`. Use
    `ingestion/scripts/generate-telemetry-seed.py` to generate synthetic data.
    See `docs/telemetry/Design/Telemetry_Seed_Data_Guide.md`.
  - Ensure automated tests cover parser/unit + integration scenarios (see new
    `ingestion/tests/integration/test_liverc_connector_integration.py`).
  - Treat metrics/alerts as first-class deliverables when changing ingestion
    behaviours.

## 3. Collaboration Workflow

1. **Consult Role Docs** – Confirm which agent (role) owns the change
   (`docs/roles/`).
2. **Check Existing Reviews** – Read `docs/reviews/*.md` to understand known
   gaps before coding.
3. **Update Docs + Code Together** – Any change to contract, operations, or
   architecture must update the relevant `docs/` entry concurrently.
4. **Validate with Fixtures** – Before shipping parser/ingestion changes, replay
   fixtures and update metadata under `ingestion/tests/fixtures/` if upstream
   pages changed. LiveRC: `ingestion/tests/fixtures/liverc/`. Telemetry:
   `ingestion/tests/fixtures/telemetry/` (see Telemetry Seed Data Guide).
5. **Publish Artefacts** – Log outputs, Prometheus metrics, and CLI reports must
   remain intact to support operations.

## 4. Onboarding Checklist for New Agents

- [ ] Read `README.md` end-to-end for version 0.1.1 scope and guardrails.
- [ ] Review architecture documents under `docs/architecture/` relevant to your
      domain.
- [ ] Verify Docker/CLI workflows by running the commands in
      `docs/operations/liverc-operations-guide.md`.
- [ ] Study the role profile closest to your responsibilities
      (`docs/roles/*.md`).
- [ ] Run `npm test` / `pytest` (see `package.json` and `ingestion/README.md`)
      to ensure a green baseline.

Adhering to this handbook keeps multi-agent work predictable, auditable, and
aligned with the version 0.1.1 release objectives.
