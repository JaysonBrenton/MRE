# Telemetry Documentation Index

Telemetry design and implementation documentation for MRE. Covers ingestion,
processing, storage, API, and end-user experience for GNSS and IMU telemetry
import and analysis.

## Document Map

### Start Here

| Document | Purpose |
| -------- | ------- |
| [User Story: Universal Telemetry Import and Analysis](User_Story/User_Story_Universal_Telemetry_Import_and_Analysis_(GNSS_+_IMU).md) | Primary user story, acceptance criteria, assumptions |
| [Exploring the End User Experience](End_User_Experience/Exploring_the_End_User_Experience_for_Telemetry_in_MRE.md) | JTBD, UX discovery plan, design approach |
| [Telemetry UX Blueprint](Design/Telemetry_Ux_Blueprint.md) | Prioritised views, navigation, interaction model, vocabulary |

### Design (Architecture & Contracts)

| Document | Purpose |
| -------- | ------- |
| [**Telemetry Implementation Design**](Design/Telemetry_Implementation_Design.md) | Master implementation spec: roadmap, data models, parsers, fusion, IMU tiers, quality, reason codes |
| [**Telemetry MVP Implementation Decisions**](Design/Telemetry_MVP_Implementation_Decisions.md) | Authoritative MVP decisions: job table, upload/artifact lifecycle, storage, session time, fixtures, naming, sharing |
| [**Telemetry Import UX Design**](Design/Telemetry_Import_UX_Design.md) | End-user import flow: entry points, upload, capture hints, processing feedback, error states |
| [Architecture Blueprint](Design/Architecture_Blueprint_Telemetry_Ingest_Storage_Compute_Query.md) | Ingest, storage, compute, query system design |
| [API Contract](Design/API_Contract_Telemetry.md) | Endpoints, query patterns, service boundaries |
| [Concrete Data Model and Contracts](Design/Telemetry%20-%20Concrete%20Data%20Model%20And%20Contracts.md) | Postgres plus ClickHouse schema and contracts |
| [Processing Pipeline and State Machine](Design/Telemetry%20Processing%20Pipeline%20Job%20Orchestration%20and%20State%20Machine.md) | Job orchestration, states, idempotency |

### Design (Algorithms & Formats)

| Document | Purpose |
| -------- | ------- |
| [GNSS + IMU Fusion Blueprint](Design/Gnss_plus_Imu_Fusion_Blueprint.md) | Normalisation and fusion |
| [Lap Segment and Corner Detection](Design/Lap%20Segment%20and%20Corner%20Detection%20Specification.md) | Lap, segment, corner detection spec |
| [Supported Formats and Parser Specification](Design/Supported%20Formats%20and%20Parser%20Specification.md) | File formats, parsers, capability detection |
| [Trust Quality Scoring and Honesty Rules](Design/Trust%20Quality%20Scoring%20and%20Honesty%20Rules.md) | Quality scoring, when to warn or hide |

### Design (Operations & Quality)

| Document | Purpose |
| -------- | ------- |
| [Security Privacy Retention and Deletion](Design/Security%20Privacy%20Retention%20and%20Deletion.md) | Security, privacy, retention, deletion |
| [Performance Plan and Benchmarking](Design/Performance%20Plan%20and%20Benchmarking.md) | Performance budgets, benchmarks |
| [Operational Runbook](Design/Operational%20Runbook.md) | Ops procedures, health, failure modes |
| [Test Strategy and Synthetic Datasets](Design/Test%20Strategy%20and%20Synthetic%20Datasets.md) | Testing approach, synthetic data |
| [Telemetry Seed Data Guide](Design/Telemetry_Seed_Data_Guide.md) | How to create seed data for testing and UX |

### Related ADRs

| ADR | Purpose |
| --- | ------- |
| [ADR-20260203: Time series Parquet canonical, ClickHouse cache](../adr/ADR-20260203-time-series-parquet-canonical-clickhouse-cache.md) | Storage: Parquet as system of record, ClickHouse as derived cache |
| [ADR-20260131: Telemetry storage and raw retention](../adr/ADR-20260131-telemetry-storage-and-raw-retention.md) | Raw upload retention policy |
| [ADR-20260131: Telemetry identifier strategy](../adr/ADR-20260131-telemetry-identifier-strategy.md) | ID format (UUID) |

### Related Design Docs

| Document | Purpose |
| -------- | ------- |
| [Telemetry Visualization Specification](../design/telemetry-visualization-specification.md) | Chart types, data sources, performance (desktop-only) |

### Reviews

| Document | Purpose |
| -------- | ------- |
| [Telemetry Design Review](reviews/telemetry_design_review.md) | Design review notes, conflicts, recommended fixes |
| [Gaps And Recommended Additions](reviews/Old/Gaps%20And%20Recommended%20Additions.md) | Earlier gap analysis (archived) |

## Platform Scope

- **Desktop-only** for first release. No mobile web support.
- A separate native mobile app is planned for a future release.
- See [Architecture Guidelines](../architecture/mobile-safe-architecture-guidelines.md) and
  [Telemetry UX Blueprint](Design/Telemetry_Ux_Blueprint.md) for details.

## Implementation Order

Suggested order for moving from docs to code:

1. Infrastructure (object storage, job queue, worker)
2. Data model and schema (Postgres + Parquet layout)
3. API contract (upload, finalise, sessions)
4. Processing pipeline and state machine
5. Supported formats and parser spec
6. Trust, quality, honesty rules (v1)

**Task-level plan:** [docs/implimentation_plans/telemetry-implementation-plan.md](../implimentation_plans/telemetry-implementation-plan.md) — prerequisites, phase dependencies, MVP task breakdown, testing, documentation, and operations. See also [Telemetry Implementation Design](Design/Telemetry_Implementation_Design.md) §9 and the [design review](reviews/telemetry-implementation-plan-review.md).

## Seed Data and Fixtures

- **Track templates:** `ingestion/tests/fixtures/telemetry/track-templates/` (KML)
- **Generator:** `ingestion/scripts/generate-telemetry-seed.py`
- **Pack A fixture:** `synth/pack-a/cormcc-clean-position-only/` (CSV + metadata)
- **Guide:** [Telemetry Seed Data Guide](Design/Telemetry_Seed_Data_Guide.md)
