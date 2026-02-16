# Telemetry Documentation Deep Review

**Date:** 2026-02-13  
**Scope:** All telemetry-related documentation under `docs/telemetry/`, related ADRs, `docs/design/telemetry-visualization-specification.md`, and cross-references in specs, AGENTS.md, and README.  
**Purpose:** Very deep review of telemetry docs for consistency, gaps, contradictions, and implementation readiness.

---

## 1. Documentation Map and Authority

### 1.1 Entry points

| Document | Role |
|----------|------|
| `docs/telemetry/README.md` | Index and implementation order; single entry for "start here". |
| User Story, End User Experience, UX Blueprint | Product intent and UX; no technical authority for storage/API. |
| ADRs (`docs/adr/ADR-20260131-*`, `ADR-20260203-*`) | **Authoritative** for storage, retention, IDs, Parquet vs ClickHouse. |

### 1.2 Design authority (by topic)

| Topic | Authoritative doc(s) | Notes |
|-------|------------------------|-------|
| Storage & retention | ADR-20260203 (Parquet canonical, ClickHouse cache); ADR-20260131 raw retention (superseded on time-series by ADR-20260203) | Raw bytes discarded after canonicalisation; Parquet = system of record; ClickHouse = derived cache. |
| Identifiers | ADR-20260131-telemetry-identifier-strategy | UUIDs only, no prefixes. |
| API contract | `Design/API_Contract_Telemetry.md` | Must align with UUIDs and Parquet/ClickHouse semantics. |
| Data model | `Design/Telemetry - Concrete Data Model And Contracts.md` | Postgres + ClickHouse schemas; must reference ADRs. |
| Pipeline & jobs | `Design/Telemetry Processing Pipeline Job Orchestration and State Machine.md` | States, idempotency, retries. |
| Quality & trust | `Design/Trust Quality Scoring and Honesty Rules.md` | Scores, gates, reason codes, disclosure. |
| Security & deletion | `Design/Security Privacy Retention and Deletion.md` | Must use ADR truth table for lifecycle. |
| Visualization (UI charts) | `docs/design/telemetry-visualization-specification.md` | Chart types, data sources, desktop-only; separate from telemetry *ingestion* design. |

### 1.3 Resolved by prior reviews (2026-01-31, 2026-02-03)

The existing `telemetry_design_review.md` and ADRs already resolved:

- **Raw retention:** Discard raw bytes after canonicalisation (ADR-20260131; reiterated in ADR-20260203 context).
- **Time-series store:** Parquet canonical, ClickHouse derived cache (ADR-20260203 supersedes ADR-20260131 on this point).
- **IDs:** UUIDs everywhere (ADR-20260131-telemetry-identifier-strategy).
- **Lifecycle truth table:** In Security doc §10.3 and ADR-20260203.

---

## 2. Cross-Document Consistency Check

### 2.1 Storage and retention

- **Architecture Blueprint:** States "raw bytes are discarded after canonicalisation" and Parquet canonical, ClickHouse cache; **aligned** with ADR-20260203.
- **Concrete Data Model:** "Raw bytes must be deleted after canonicalisation"; **aligned**.
- **Security Privacy Retention:** Category B raw artifacts = "discarded immediately after successful canonicalisation"; **aligned**. Truth table in §10.3 matches ADR-20260203.
- **API Contract:** References ADR for storage authority; **aligned**.

**Verdict:** No remaining contradiction on raw retention or Parquet/ClickHouse.

### 2.2 Identifiers

- **API Contract:** Examples still use `"upl_01H..."`, `"lap_01H..."`, `"seg_01H..."`, `"cor_01H..."` in request/response samples (e.g. §§6.1–6.9). ADR-20260131 says "Store and expose UUIDs without type prefixes" and "API contract doc and all examples must use UUIDs".
- **Concrete Data Model:** Uses UUIDs throughout; **aligned** with ADR.
- **Gap:** API Contract doc was not fully updated to replace prefixed-ID examples with UUIDs. **Recommendation:** Replace all `*_01H...` style IDs in API_Contract_Telemetry.md with standard UUIDs (e.g. `550e8400-e29b-41d4-a716-446655440000`) and add one sentence in §4.2: "All IDs are UUIDs; see ADR-20260131-telemetry-identifier-strategy."

### 2.3 Materialisation and API semantics

- **ADR-20260203:** Introduces materialisation job, `materialisation_status`, and read-path behaviour (trigger materialisation or fallback). **API Contract** does not yet define `materialisation_status` or `data_freshness` in session or timeseries responses.
- **Recommendation:** Add to API Contract: session detail and timeseries responses include `processing_run_id`, `schema_version`, `materialisation_status` (e.g. ready | pending | stale | failed), and optional `last_materialised_at` where applicable.

### 2.4 Visualization vs ingestion

- **telemetry-visualization-specification.md:** Describes lap time charts, speed graphs, GPS track, sensor data, sector analysis; data sources = LiveRC lap data now, future telemetry APIs. Refers to `/api/v1/telemetry/stream`, `/api/v1/telemetry/[sessionId]`, `/api/v1/telemetry/sensors` as future.
- **Telemetry Design (docs/telemetry/):** Defines sessions, uploads, processing runs, laps, timeseries, map, segments; API base `/api/v1/telemetry` with sessions, laps, timeseries, map, segments, etc.
- **Verdict:** Visualization spec is consistent with telemetry design (desktop-only, same API namespace). Minor cleanup: ensure future endpoints in visualization spec match API Contract (e.g. sessions vs sessionId) and point to `docs/telemetry/Design/API_Contract_Telemetry.md` as the source of record for API shape.

---

## 3. Gaps and Risks (Post-ADR)

### 3.1 API Contract

- **License:** Header says "License: Proprietary, internal to MRE" in the file read; the earlier review mentioned "License: TBD". If any copy still says TBD, set to "Proprietary, internal to MRE".
- **IDs:** As above; replace prefixed examples with UUIDs.
- **Materialisation:** Add `materialisation_status` (and optional freshness) to session and timeseries responses per ADR-20260203.
- **Downsample level naming:** Doc uses `ds_50hz`, `ds_10hz`, etc. Pipeline doc uses `L0`, `L1`, `L2` and "level names can be L0, L1, L2 or explicit sample rates". **Recommendation:** In API Contract, state that level names are implementation-defined but must be consistent with pipeline output (e.g. map `ds_10hz` ↔ pipeline L1 in narrative or a small mapping table).

### 3.2 Data model and ClickHouse

- **Concrete Data Model:** Section 8.5 appears twice (8.5 Fused pose stream and 8.6 Downsampled tables; 8.5 Canonical magnetometer is 8.7 in content). Section numbering bug: two "8.5" and "8.6" usages. **Recommendation:** Renumber sections 8.5–8.7 and 8.5–8.6 for uniqueness.
- **ClickHouse as cache:** Doc already states "ClickHouse is a derived, rebuildable cache" and references ADR-20260203. Schema is appropriate for a cache (session_id, run_id, ts, etc.). No contradiction.

### 3.3 Pipeline and orchestration

- **Pipeline doc:** Defines job types, states, idempotency, retries; suggests Postgres-backed queue first. No conflict with other docs.
- **Gap:** ADR-20260203 adds a `materialise_clickhouse` job type. Pipeline doc’s "Stage 5: Publish" includes `publish_session` but does not list materialisation. **Recommendation:** Add a stage (e.g. after downsample or before publish) or a step under publish: "materialise_clickhouse (writes derived data to ClickHouse from canonical Parquet)" and reference ADR-20260203.

### 3.4 Security and deletion

- **Deletion:** Security doc and ADR-20260203 agree: delete canonical Parquet first, then ClickHouse; no raw blob retention. Truth table is clear.
- **Operational Runbook:** Deletion verification and reaper behaviour are described. **Aligned.**

### 3.5 Trust and quality

- **Trust doc:** Reason codes, task scores, feature gating, API requirements for quality/confidence/provenance. **API Contract** already includes `quality` and `reasons` in session and lap responses; can add explicit "reason code enum or stable strings" reference to Trust doc for implementers.

### 3.6 Lap, segment, corner detection

- **Lap/Segment/Corner spec:** Very detailed (SFL, crossing detection, segments, corners, jump detection, confidence, overrides). No conflict with data model or API.
- **Gap (from original review):** Wrong track or track catalogue mismatch is not explicitly handled. **Recommendation:** Add a short subsection or reason code for "track template mismatch" / "catalogue track does not match session" and UI behaviour (degrade segment confidence or fall back to auto-inferred only).

### 3.7 Supported formats and parsers

- **Parser spec:** Plugin contract, safety, capability model, fusion provenance. **Gap (from original review):** Minimum canonical stream set required for lap detection and for quality scoring is not explicitly listed. **Recommendation:** Add one bullet list: "Minimum for lap detection: GNSS position stream (or pose stream) with t and position; minimum for quality scoring: timestamps and at least one of GNSS quality fields or IMU stream."

### 3.8 Performance and benchmarking

- **Performance plan:** Budgets, SLOs, size classes (S/M/L/XL), benchmark harness, regression thresholds. References "synthetic dataset plan" in Test Strategy. **Aligned.** Optional: add one sentence in Performance doc that benchmark dataset packs (e.g. Pack A/B/C) are those defined in Test Strategy and Seed Data Guide.

### 3.9 Operational runbook

- **Runbook:** Health, alerts, failure modes, playbooks, retention/deletion. **Gap (from original review):** "Known bad patterns" for ingestion (timebase mismatch, IMU axis confusion, GNSS jitter, missing timestamps) could be added as a short subsection with error codes and first checks.

### 3.10 Test strategy and seed data

- **Test Strategy:** Synthetic framework, packs (A/B/C), determinism, regression. **Seed Data Guide:** Purpose (testing vs UX), storage layout, generator usage, required dummy sessions. **Aligned.** Generator script and Pack A fixture path are consistent across README, ingestion README, and Seed Data Guide.

---

## 4. Visualization Specification vs Telemetry Ingestion

- **telemetry-visualization-specification.md:** Standalone under `docs/design/`; defines *what* to build (lap time, speed, GPS, sensor, sector) and that components are required even when data is missing. Data sources: LiveRC now, telemetry later.
- **docs/telemetry/:** Define *how* telemetry is ingested, stored, and queried (sessions, processing, laps, timeseries, map, segments).
- **Relationship:** Visualization spec is the UI contract for charts and maps; telemetry design is the backend and API contract. Both state desktop-only and point to future telemetry APIs. **Recommendation:** In visualization spec "Related Documentation", add: "Telemetry API and data model: `docs/telemetry/README.md`, `docs/telemetry/Design/API_Contract_Telemetry.md`."

---

## 5. AGENTS.md and README

- **AGENTS.md:** Telemetry fixtures path, Seed Data Guide, and containerised commands are correct. Quality & Observability agent references telemetry fixtures and generate-telemetry-seed.py; **aligned.**
- **README:** Telemetry ingestion, upload, docs/telemetry/, seed data command, and visualization scope are consistent with the design set. **Aligned.**

---

## 6. Strengths (Summary)

- **Single storage and retention story** after ADRs: Parquet canonical, ClickHouse cache, raw discarded.
- **Clear UX and product intent:** User story, JTBD, UX Blueprint, and 30-second insight bar are consistent.
- **End-to-end coverage:** Ingest → parse → normalise → downsample → fuse → laps/segments/corners → quality → API → deletion, with security and operations.
- **Honesty and trust:** Explicit provenance, confidence, reason codes, and no silent smoothing.
- **Implementation aids:** API contract, data model, pipeline states, runbook, performance budgets, test strategy, seed data guide.

---

## 7. Recommended Actions (Priority)

**Status: All resolved (2026-02-13)**

1. ~~**High:** Update API_Contract_Telemetry.md: (a) replace all prefixed-ID examples with UUIDs; (b) add `materialisation_status` (and optional freshness) to session and timeseries responses; (c) add one-sentence reference to ADR-20260131 for IDs.~~ ✅
2. ~~**High:** Fix duplicate section numbering in Concrete Data Model (sections 8.5–8.7 / 8.5–8.6).~~ ✅
3. ~~**Medium:** In Pipeline doc, add `materialise_clickhouse` job type (or step under publish) and reference ADR-20260203.~~ ✅
4. ~~**Medium:** In API Contract, document downsample level naming and its relationship to pipeline levels (L0/L1/L2 or rate-based).~~ ✅
5. ~~**Low:** Lap/Segment/Corner spec: add handling/reason code for track catalogue mismatch.~~ ✅
6. ~~**Low:** Supported Formats: add minimum canonical stream set for lap detection and for quality scoring.~~ ✅
7. ~~**Low:** Operational Runbook: add "Known bad patterns" (timebase, IMU axis, GNSS jitter, missing timestamps) with error codes and first checks.~~ ✅
8. ~~**Low:** Visualization spec: add related doc links to `docs/telemetry/README.md` and API Contract.~~ ✅
9. ~~**Housekeeping:** Confirm API_Contract_Telemetry.md header has "License: Proprietary, internal to MRE" (no TBD). Remove any `.DS_Store` from `docs/telemetry/` and ensure `.gitignore` includes it.~~ ✅ (.gitignore already has .DS_Store; no .DS_Store files in repo)

---

## 8. Conclusion

The telemetry documentation set is **coherent and implementation-ready** after the 2026-01-31 and 2026-02-03 ADRs. Remaining work is mostly **alignment and small additions**: UUIDs and materialisation in the API Contract, pipeline materialisation step, a few spec clarifications (data model numbering, minimum streams, track mismatch, runbook bad patterns), and cross-links. No fundamental contradictions remain between storage, retention, deletion, and identifiers.
