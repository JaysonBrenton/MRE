# Telemetry Documentation Index

Telemetry design and implementation documentation for MRE. Covers ingestion,
processing, storage, API, and end-user experience for GNSS and IMU telemetry
import and analysis.

## Implementation status (as of 2026-05-31)

Telemetry is **substantially implemented and shipping**. Many docs in this tree
were written forward-looking ("planned / MVP / Phase X"); each now carries an
**Implementation status** note describing what is built today versus still
aspirational. Verify against the code, which is the source of truth:
`src/app/api/v1/telemetry/**`, `src/core/telemetry/**`,
`ingestion/telemetry/**`, and the `Telemetry*` models in `prisma/schema.prisma`.

**Built today (verified against code):**

- Upload → worker → **canonical Parquet** (system of record) under
  `TELEMETRY_UPLOAD_ROOT` (`/data/telemetry`), with an **optional ClickHouse
  GNSS cache** (`telemetry_gnss_v1`, enabled only when `CLICKHOUSE_HOST` is set;
  Parquet + API work without it).
- `telemetry-worker` service (`python -m ingestion.telemetry.worker`) polling
  the Postgres `telemetry_jobs` queue with `FOR UPDATE SKIP LOCKED`. Two job
  stages are wired: **`artifact_validate` → `parse_raw`** (parse_raw also runs
  downsample, fusion pass-through, lap/segment/quality post-processing).
- GNSS parsers implemented: **CSV, GPX, JSON, NMEA, UBX**. Garmin FIT is
  rejected.
- IMU parsing (`parsers/imu_sample.py`) and the **EKF fusion** module
  (`fusion_ekf.py`) exist and are unit-tested, but are **not wired into the live
  worker** yet (`imu_samples` is always empty in `pipeline_v1.py`, so fused pose
  is GNSS-only pass-through, `pose_source = "gnss_only"`).
- Lap detection (user SFL / track-catalogue SFL / auto loop), heuristic
  segment/corner detection, quality scoring v1, GNSS downsample variants.
- Sessions API (list/detail/PATCH/DELETE), plus `laps`, `timeseries`, `map`,
  `quality`, `coaching`, `export`, `reprocess`, `retry`, `share`, `compare`, and
  public `share/[token]` (+ `/map`) endpoints. Viewer pages at
  `/eventAnalysis/my-telemetry[/[sessionId]]`.
- **Read-only sharing is implemented** (share-token mint/revoke + public read
  endpoints), so the "MVP private only" statement in
  [Telemetry MVP Implementation Decisions](Design/Telemetry_MVP_Implementation_Decisions.md)
  §9 is now out of date.

**Still aspirational / not built:** signed-URL uploads (the app uses a direct
`PUT .../bytes`), `channels`, `laps/{lapId}`, `laps/compare`, `segments`, and
`processing-runs` HTTP endpoints, Arrow IPC export (`format=arrow` returns 501),
the `teams` / share-grant / `telemetry_segments` / `telemetry_edits` tables, and
ClickHouse accel/gyro/mag/pose tables. The richer GNSS PVT field set
(`course_deg`, `hacc_m`, `sat_count`, `fix_type`, `quality_flags`) is documented
but not yet written to canonical Parquet.

## Document Map

### Start Here

| Document                                                                                                                               | Purpose                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| [User Story: Universal Telemetry Import and Analysis](<User_Story/User_Story_Universal_Telemetry_Import_and_Analysis_(GNSS_+_IMU).md>) | Primary user story, acceptance criteria, assumptions         |
| [Exploring the End User Experience](End_User_Experience/Exploring_the_End_User_Experience_for_Telemetry_in_MRE.md)                     | JTBD, UX discovery plan, design approach                     |
| [Telemetry UX Blueprint](Design/Telemetry_Ux_Blueprint.md)                                                                             | Prioritised views, navigation, interaction model, vocabulary |

### Design (Architecture & Contracts)

| Document                                                                                                                           | Purpose                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| [**Telemetry Implementation Design**](Design/Telemetry_Implementation_Design.md)                                                   | Master implementation spec: roadmap, data models, parsers, fusion, IMU tiers, quality, reason codes                 |
| [**Telemetry MVP Implementation Decisions**](Design/Telemetry_MVP_Implementation_Decisions.md)                                     | Authoritative MVP decisions: job table, upload/artifact lifecycle, storage, session time, fixtures, naming, sharing |
| [**Telemetry Import UX Design**](Design/Telemetry_Import_UX_Design.md)                                                             | End-user import flow: entry points, upload, capture hints, processing feedback, error states                        |
| [Architecture Blueprint](Design/Architecture_Blueprint_Telemetry_Ingest_Storage_Compute_Query.md)                                  | Ingest, storage, compute, query system design                                                                       |
| [API Contract](Design/API_Contract_Telemetry.md)                                                                                   | Endpoints, query patterns, service boundaries                                                                       |
| [Concrete Data Model and Contracts](Design/Telemetry%20-%20Concrete%20Data%20Model%20And%20Contracts.md)                           | Postgres plus ClickHouse schema and contracts                                                                       |
| [Processing Pipeline and State Machine](Design/Telemetry%20Processing%20Pipeline%20Job%20Orchestration%20and%20State%20Machine.md) | Job orchestration, states, idempotency                                                                              |

### Design (Algorithms & Formats)

| Document                                                                                                   | Purpose                                     |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| [GNSS + IMU Fusion Blueprint](Design/Gnss_plus_Imu_Fusion_Blueprint.md)                                    | Normalisation and fusion                    |
| [Lap Segment and Corner Detection](Design/Lap%20Segment%20and%20Corner%20Detection%20Specification.md)     | Lap, segment, corner detection spec         |
| [Supported Formats and Parser Specification](Design/Supported%20Formats%20and%20Parser%20Specification.md) | File formats, parsers, capability detection |
| [Trust Quality Scoring and Honesty Rules](Design/Trust%20Quality%20Scoring%20and%20Honesty%20Rules.md)     | Quality scoring, when to warn or hide       |

### Design (Operations & Quality)

| Document                                                                                             | Purpose                                    |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| [Security Privacy Retention and Deletion](Design/Security%20Privacy%20Retention%20and%20Deletion.md) | Security, privacy, retention, deletion     |
| [Performance Plan and Benchmarking](Design/Performance%20Plan%20and%20Benchmarking.md)               | Performance budgets, benchmarks            |
| [Operational Runbook](Design/Operational%20Runbook.md)                                               | Ops procedures, health, failure modes      |
| [Test Strategy and Synthetic Datasets](Design/Test%20Strategy%20and%20Synthetic%20Datasets.md)       | Testing approach, synthetic data           |
| [Telemetry Seed Data Guide](Design/Telemetry_Seed_Data_Guide.md)                                     | How to create seed data for testing and UX |

### Related ADRs

| ADR                                                                                                                                    | Purpose                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [ADR-20260203: Time series Parquet canonical, ClickHouse cache](../adr/ADR-20260203-time-series-parquet-canonical-clickhouse-cache.md) | Storage: Parquet as system of record, ClickHouse as derived cache |
| [ADR-20260131: Telemetry storage and raw retention](../adr/ADR-20260131-telemetry-storage-and-raw-retention.md)                        | Raw upload retention policy                                       |
| [ADR-20260131: Telemetry identifier strategy](../adr/ADR-20260131-telemetry-identifier-strategy.md)                                    | ID format (UUID)                                                  |

### Related Design Docs

| Document                                                                                    | Purpose                                               |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| [Telemetry Visualization Specification](../design/telemetry-visualization-specification.md) | Chart types, data sources, performance (desktop-only) |

### Reviews

| Document                                                                              | Purpose                                           |
| ------------------------------------------------------------------------------------- | ------------------------------------------------- |
| [Telemetry Design Review](reviews/telemetry_design_review.md)                         | Design review notes, conflicts, recommended fixes |
| [Gaps And Recommended Additions](reviews/Old/Gaps%20And%20Recommended%20Additions.md) | Earlier gap analysis (archived)                   |

## Product policy: Garmin and FIT

MRE does **not** support Garmin devices or the Garmin FIT (`.fit`) format.
Telemetry documentation, API reference, and user-facing copy must not describe
FIT as a supported or recommended import path. A legacy FIT code path may still
exist until it is removed from the application.

## Platform Scope

- **Desktop-only** for first release. No mobile web support.
- A separate native mobile app is planned for a future release.
- See
  [Architecture Guidelines](../architecture/mobile-safe-architecture-guidelines.md)
  and [Telemetry UX Blueprint](Design/Telemetry_Ux_Blueprint.md) for details.

## Implementation Order

Suggested order for moving from docs to code:

1. **Done:** Infrastructure through **v1 / v2-style telemetry** (upload, worker,
   canonical Parquet, optional ClickHouse, compare/share/reprocess, admin track
   SFL, UI). See
   [telemetry-implementation-plan.md](../implimentation_plans/telemetry-implementation-plan.md).
2. **Ongoing:** Operational tuning (metrics `telemetry_jobs_total*`, cooldowns),
   retention policies per ADR, and product analytics beyond the compare API.

**Task-level plan:**
[docs/implimentation_plans/telemetry-implementation-plan.md](../implimentation_plans/telemetry-implementation-plan.md)
— prerequisites, phase dependencies, MVP task breakdown, testing, documentation,
and operations. See also
[Telemetry Implementation Design](Design/Telemetry_Implementation_Design.md) §9
and the [design review](reviews/telemetry-implementation-plan-review.md).

## Seed Data and Fixtures

- **Track templates:** `ingestion/tests/fixtures/telemetry/track-templates/`
  (KML)
- **Generator:** `ingestion/scripts/generate-telemetry-seed.py`
- **Pack A fixture:** `synth/pack-a/cormcc-clean-position-only/` (CSV +
  metadata)
- **Guide:** [Telemetry Seed Data Guide](Design/Telemetry_Seed_Data_Guide.md)
