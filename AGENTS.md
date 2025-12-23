---
created: 2025-12-23
owner: Architecture & Enablement
purpose: Describe all autonomous / semi-autonomous contributors (human or LLM) that operate inside the MRE repo and the guardrails they must obey.
relatedDocs:
  - README.md
  - docs/specs/mre-alpha-feature-scope.md
  - docs/architecture/
  - docs/operations/
  - docs/roles/
---

# MRE Agents Handbook

This repository is intentionally built for multi-agent collaboration (human specialists + LLM assistants). Every contributor must understand the agents in play, their domains, and the guardrails defined by the Alpha program.

## 1. Global Guardrails (Apply to All Agents)
- **Alpha Scope Only** – Follow the feature list in `README.md` and `docs/specs/mre-alpha-feature-scope.md#6-llm-guardrails`. Reject any change outside registration, login, welcome/admin pages, and LiveRC ingestion.
- **Docs Are Canon** – Architecture, ops, security, and UX documents under `docs/` outrank code comments. Quote them when defending design decisions.
- **Folder Contracts** – Next.js logic lives under `src/`, Python ingestion under `ingestion/`, and all knowledge artifacts under `docs/`. Do not cross-contaminate.
- **Structured Logging + Metrics** – The ingestion service must emit structlog JSON plus Prometheus metrics (`ingestion/common/logging.py`, `ingestion/common/metrics.py`). Never add plain `print` debugging in production code.
- **CI Expectations** – Tests live under `src/__tests__` and `ingestion/tests`. Prefer fixture-backed, deterministic tests per `docs/architecture/liverc-ingestion/18-ingestion-testing-strategy.md`.

## 2. Agents and Their Domains

### 2.1 Frontend Delivery Agent (Next.js + TypeScript)
- **Scope**: All UI, API routes, and domain logic inside the Next.js app (`src/app`, `src/core`, `src/api`).
- **Primary References**: `docs/architecture/mobile-safe-architecture-guidelines.md`, `docs/design/mre-dark-theme-guidelines.md`, `docs/design/mre-mobile-ux-guidelines.md`.
- **Rules**:
  - Never access Prisma directly from React components; use `src/core/.../repo.ts` per architecture rules.
  - Preserve the strict dark theme + mobile UX constraints noted in the README.
  - Tests for UI logic belong in `src/__tests__` and must mirror the documented behaviours.

### 2.2 LiveRC Ingestion Agent (Python Service)
- **Scope**: Python microservice under `ingestion/` handling track/event discovery, ingestion pipeline, and CLI.
- **Key Components**:
  - Connector + parsers (`ingestion/connectors/liverc/`)
  - Pipeline orchestrator (`ingestion/ingestion/pipeline.py`)
  - Repository (SQLAlchemy) layer (`ingestion/db/repository.py`)
  - CLI commands + cron wrappers (`ingestion/cli/commands.py`, `ingestion/scripts/*.sh`, `ingestion/crontab`)
- **Guardrails**:
  - Follow the HTTPX→Playwright fallback decision tree defined in `docs/architecture/liverc-ingestion/02-connector-architecture.md`.
  - Maintain idempotency and locking semantics from `docs/architecture/liverc-ingestion/03-ingestion-pipeline.md` and the implementation of advisory locks.
  - Observability: log via structlog, emit Prometheus metrics (`ingestion/common/metrics.py`), and keep tracing breadcrumbs (`ingestion/common/tracing.py`).
  - Ops: automated cron workflows include track sync and followed-track event refresh (`ingestion/scripts/run-track-sync.sh`, `ingestion/scripts/run-followed-event-sync.sh`). Cron timing is documented in `docs/operations/liverc-operations-guide.md`.

### 2.3 DevOps / Platform Agent
- **Scope**: Docker images, orchestration scripts, and environment bootstrapping (see `Dockerfile`, `docker-compose.yml`, `dc/`, `docs/operations/docker-user-guide.md`).
- **Tasks**:
  - Keep container entrypoints in sync with cron scripts.
  - Ensure Playwright dependencies exist in the ingestion container (per `ingestion/requirements.txt`).
  - Maintain the `reports/` artefacts produced by CLI jobs.

### 2.4 Documentation & Knowledge Agent
- **Scope**: Entire `docs/` tree plus repo root knowledge artefacts (`README.md`, `STATUS.md`, review docs).
- **Responsibilities**:
  - Update ADRs when architectural changes occur (`docs/adr/`).
  - Keep review documents under `docs/reviews/` in sync with actual implementation changes.
  - Uphold role definitions under `docs/roles/` so that other agents know who owns which layer.

### 2.5 Quality & Observability Agent
- **Scope**: Testing strategies (`ingestion/tests`, `src/__tests__`), monitoring, and incident response.
- **References**:
  - `docs/architecture/liverc-ingestion/18-ingestion-testing-strategy.md`
  - `docs/architecture/liverc-ingestion/15-ingestion-observability.md`
  - `docs/roles/quality-automation-engineer.md`
  - `docs/roles/observability-incident-response-lead.md`
- **Expectations**:
  - Maintain fixture parity with upstream LiveRC HTML under `ingestion/tests/fixtures/liverc/`.
  - Ensure automated tests cover parser/unit + integration scenarios (see new `ingestion/tests/integration/test_liverc_connector_integration.py`).
  - Treat metrics/alerts as first-class deliverables when changing ingestion behaviours.

## 3. Collaboration Workflow
1. **Consult Role Docs** – Confirm which agent (role) owns the change (`docs/roles/`).
2. **Check Existing Reviews** – Read `docs/reviews/*.md` to understand known gaps before coding.
3. **Update Docs + Code Together** – Any change to contract, operations, or architecture must update the relevant `docs/` entry concurrently.
4. **Validate with Fixtures** – Before shipping parser/ingestion changes, replay fixtures and update metadata under `ingestion/tests/fixtures/` if upstream pages changed.
5. **Publish Artefacts** – Log outputs, Prometheus metrics, and CLI reports must remain intact to support operations.

## 4. Onboarding Checklist for New Agents
- [ ] Read `README.md` end-to-end for Alpha scope and guardrails.
- [ ] Review architecture documents under `docs/architecture/` relevant to your domain.
- [ ] Verify Docker/CLI workflows by running the commands in `docs/operations/liverc-operations-guide.md`.
- [ ] Study the role profile closest to your responsibilities (`docs/roles/*.md`).
- [ ] Run `npm test` / `pytest` (see `package.json` and `ingestion/README.md`) to ensure a green baseline.

Adhering to this handbook keeps multi-agent work predictable, auditable, and aligned with the Alpha release objectives.
