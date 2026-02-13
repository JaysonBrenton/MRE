# Test Strategy and Synthetic Datasets

Author: Jayson Brenton  
Date: 2026-01-30  
Purpose: Define a comprehensive test strategy for MRE telemetry ingestion,
processing, and analytics, including synthetic dataset generation, golden
fixtures, regression testing, determinism checks, security testing, and
performance validation.  
License: Proprietary, internal to MRE

## 1. Scope

This document defines:

- Test layers and ownership boundaries for MRE (web UI, API, pipeline workers,
  parsers, algorithms)
- Synthetic dataset framework to generate repeatable RC telemetry sessions
- Golden fixtures and expected outputs for parsers, fusion, lap, segment, and
  corner detection
- Regression detection for correctness, stability, and quality scoring drift
- Non-functional testing: performance, reliability, security, privacy, and
  deletion correctness
- CI execution plan and release readiness gates

Out of scope:

- Vendor legal compliance testing beyond basic integrity and security
- Full UI design tests beyond required flows and accessibility checks

## 2. Design goals

- Catch defects early with fast unit tests and deterministic synthetic data
- Ensure telemetry algorithms are reproducible and do not drift unintentionally
- Guarantee honesty rules, quality scoring, and feature gating behave
  consistently
- Build confidence in parser correctness across messy real-world files
- Provide a clear path to scale test coverage without slowing development

## 3. Guiding principles

- **Deterministic by default**: Synthetic datasets must be fully reproducible
  via seed.
- **Layered testing**: Prefer many small tests, plus fewer end-to-end tests.
- **Contract-first**: API and canonical schema contracts are tested as public
  interfaces.
- **Truthful fixtures**: Never “fake” expected outputs, compute expected where
  possible from known ground truth.
- **Privacy-safe**: Use synthetic or anonymised telemetry in repos, never raw
  user traces.

## 4. Test pyramid and layers

### 4.1 Unit tests (fast, most numerous)

Targets:

- Canonical schema validators
- Parser mapping utilities, header normalisation
- Time alignment routines
- Downsampling aggregators
- Geometry primitives, line intersections, curvature computation
- Quality scoring penalty calculators and reason code mapping
- State machine transition rules

Characteristics:

- Run in < 5 seconds per suite for typical CI
- No network, no filesystem outside test temp

### 4.2 Component tests (pipeline stage level)

Targets:

- `parse_raw` for each parser family with fixtures
- `time_align` on multi-stream datasets
- `downsample` generation correctness and chunk manifests
- `fuse_gnss_imu` output sanity and fusion health metrics
- `detect_laps`, `detect_segments`, `detect_corners` with known ground truth

Characteristics:

- Run in < 60 seconds total in CI smoke suite
- Uses small dataset packs, deterministic seeds

### 4.3 Integration tests (API + DB + storage abstractions)

Targets:

- Session lifecycle:
  - create session
  - upload artifact metadata
  - enqueue processing run
  - poll job status
  - fetch derived dataset manifests
  - fetch lap table
- Access control:
  - cross-user isolation
  - signed URL scope
- Retention reaper and deletion cascades

Characteristics:

- Uses ephemeral Postgres, storage mocked or local filesystem object store
- Runs in CI on merge to main

### 4.4 End-to-end UI tests

Targets:

- Login and upload flow
- Progress display for processing run
- Session viewer:
  - map path rendering
  - lap list
  - chart interactions at downsample levels
- Manual start/finish line override flow
- Error presentation and reason codes for unsupported formats

Characteristics:

- Limited number of critical flows
- Run nightly or on release branches to keep CI fast

### 4.5 Non-functional tests

- Performance benchmarks (see section 8 doc), run on schedule and gated for
  regressions
- Reliability tests for worker crash recovery, stale lock reaping, idempotency
- Security tests for file parsing, injection attempts, cross-tenant data leakage
- Privacy tests: verify no Restricted values in logs, deletion works

## 5. Determinism and reproducibility tests

### 5.1 Determinism contract

Given:

- identical artifact bytes and ordering
- identical pipeline versions and config
- identical random seed, if any algorithm uses randomness

Then:

- derived datasets must be identical by hash, or within defined numeric
  tolerance where floating point differences are expected

### 5.2 Determinism checks

- Hash canonical streams and derived datasets
- Re-run the same pipeline twice and compare:
  - lap boundaries
  - segment boundaries
  - corner apex points
  - key metrics tables

Allowed tolerances:

- position: <= 0.05 m in synthetic fused outputs, configurable
- time: <= 1 sample interval If tolerances exceeded, fail with a report that
  includes stage diffs.

## 6. Synthetic dataset framework

### 6.1 Why synthetic datasets

Synthetic datasets provide:

- repeatable ground truth for algorithm validation
- controlled noise and dropout models
- coverage of edge cases that may be rare in real data
- safe, privacy-friendly fixtures that can live in repo

### 6.2 Dataset generator components

The generator should model:

1. **Track geometry**
   - Parametric track templates:
     - typical 1/8 off-road layout with straights, sweepers, hairpins, jump
       sections
     - optional alternate layouts for robustness
   - Represented as a centreline polyline with width and optional elevation
     profile

2. **Vehicle motion model**
   - Simulated driver laps with:
     - variable lap times
     - braking and acceleration zones
     - line variability across laps
     - occasional mistakes, for example wide line, partial off-track

3. **Sensor model**
   - GNSS sampling:
     - rate: 1 to 25 Hz
     - noise model:
       - Gaussian positional noise
       - correlated drift
       - multipath spikes near specific track regions
     - dropout model:
       - random missing samples
       - contiguous gaps
   - IMU sampling:
     - rate: 50 to 400 Hz
     - accel and gyro with:
       - bias drift
       - noise
       - saturation events
   - On-board fusion model:
     - smoothed pose output with confidence estimates
     - ability to “coast” through GNSS gaps and expand covariance

4. **Export format writer**
   - Generate artifacts in:
     - CSV
     - GPX
     - NMEA text
     - JSON
   - Optional multi-file export sets, for example separate IMU file

5. **Ground truth metadata**
   - true SFL
   - true lap boundaries
   - true segment boundaries, if template-based
   - true corner apexes
   - true speed and curvature profiles

### 6.3 Dataset descriptors

Every synthetic dataset includes a descriptor JSON:

- `dataset_id`
- `seed`
- `track_template_id`
- `duration_s`
- `laps_expected_min`, `laps_expected_max`
- `sensor_profile`:
  - gnss_hz, imu_hz, onboard_fusion_enabled
- `noise_profile`:
  - gnss_sigma_m, imu_sigma, drift parameters
- `dropout_profile`:
  - dropout_rate, max_gap_s, gap_regions
- `edge_cases` flags:
  - pit_stop
  - marshal_pickup
  - shortcut
  - multi_stint
- `ground_truth`:
  - sfl_points
  - lap_times_true
  - segment_map_true
  - corner_apex_true

Ground truth must be used by tests, not hand-entered expected outputs.

### 6.4 Dataset size classes for tests

Define standard packs:

Pack A, smoke:

- 5 datasets, small, S class
- covers clean, noisy, dropout, pit stop, marshal pickup

Pack B, nightly:

- 20 datasets, S and M classes
- includes on-board fused and server-fused profiles
- includes multi-stint and multi-file

Pack C, perf and load:

- larger M and L class datasets
- used for benchmarking and scaling tests

## 7. Golden fixtures and expected outputs

### 7.1 Parser golden fixtures

For each parser family, maintain fixtures:

- clean example
- missing optional columns
- corrupt row
- ambiguous time format
- different delimiter and locale decimal
- multi-file set if supported

Assertions:

- canonical schema is produced
- capability map correct
- warnings and error codes correct
- no Restricted values appear in logs

### 7.2 Lap detection golden tests

Inputs:

- synthetic datasets with true SFL and lap boundaries
- variants with jitter, dropouts, and teleports

Assertions:

- detected lap count within expected range
- lap boundaries within tolerance of ground truth
- invalid laps correctly flagged on marshal pickup datasets
- reason codes present when confidence is not high

### 7.3 Segment and corner detection golden tests

Inputs:

- template-based synthetic track with segment map ground truth
- auto inference track with expected number of corners in range, not exact
  identity

Assertions:

- template segments align within tolerance
- auto segments stable across laps, boundary drift below thresholds
- corners direction correct, apex clustering within tolerance
- jump sections tagged, corners suppressed inside jump regions

### 7.4 Fusion golden tests

Inputs:

- synthetic GNSS plus IMU with known ground truth pose

Assertions:

- fused position error within threshold compared to true centreline pose
- covariance grows during GNSS gaps
- divergence flags triggered for saturation or misalignment cases

Note:

- Fusion tests must use deterministic numeric settings and fixed seed.

## 8. Regression testing strategy

### 8.1 Algorithm version regression

Whenever `lap_detection_version` or similar changes:

- run nightly pack B across baseline and candidate
- compute diffs:
  - lap count changes
  - median lap time delta
  - boundary shift distribution
  - segment boundary drift
  - corner apex shift distribution
- require explicit approval when diffs exceed thresholds

Threshold examples:

- lap count differs on > 5% of datasets
- lap time median shifts > 1% without a corresponding algorithm change note
- corner apex shifts > 1 m on > 10% of corners

### 8.2 Quality scoring drift regression

Quality scoring is sensitive to threshold changes.

Tests:

- ensure distribution of task scores stays within expected bands for known packs
- ensure reason codes remain stable for known conditions

For any scoring change:

- update baseline intentionally
- record in ADR

### 8.3 Parser regression

When parser version changes:

- verify produced canonical field mapping unchanged for fixtures unless
  intentional
- compare output hashes and row counts

## 9. Property-based and fuzz testing

### 9.1 Property-based tests

Targets:

- intersection detection invariants
- curvature stability under small noise
- timestamp monotonicity after alignment
- downsampling preserves min/max within tolerance per window

### 9.2 Fuzz testing for parsers

- feed random bytes and mutated inputs to binary and text parsers
- assert:
  - no crashes
  - errors are handled with stable codes
  - time and memory limits enforced

Include security-focused cases:

- zip bombs
- path traversal in archive entries
- extremely long lines in CSV
- Unicode edge cases

## 10. Reliability and fault-injection testing

### 10.1 Worker crash recovery

Simulate:

- worker dies mid-job
- lock becomes stale
- reaper re-queues job
- idempotency ensures no duplicate outputs

Assertions:

- job transitions follow allowed state machine
- derived datasets not duplicated or are correctly superseded
- run status derived correctly

### 10.2 Storage transient failures

Simulate:

- object store read timeout
- write partial failure

Assertions:

- retries occur with backoff
- eventual success yields correct outputs
- failure yields correct error codes and partial run behaviour

## 11. Security and privacy tests

### 11.1 Access control tests

- user A cannot access user B sessions, artifacts, datasets
- signed URLs are scoped and expire
- support role cannot access Restricted data without elevation

### 11.2 Log redaction tests

Automated checks:

- scan logs produced during tests for patterns resembling lat lon, NMEA
  sentences, or known coordinate formats
- ensure any such patterns are absent unless in explicit debug mode

### 11.3 Deletion correctness tests

- create session with artifacts and derived datasets
- delete session
- assert:
  - metadata gone or tombstoned appropriately
  - objects removed from storage
  - indexes updated
- test account deletion cascades similarly

Note:

- deletion tests must account for backup caveats, but for test environments we
  can expect immediate hard delete.

## 12. Performance tests using synthetic datasets

Performance tests must use size class packs.

- smoke perf: Pack A, ensure parse and downsample meet budgets
- nightly perf: Pack B, ensure P95 stable
- fusion perf: dedicated M class fusion datasets

Outputs:

- JSON reports with percentiles and pass fail

CI gating:

- quick perf smoke on merge to main

## 13. CI and release gating plan

### 13.1 CI stages

Stage 1, lint and type:

- TypeScript strict, formatting checks

Stage 2, unit:

- fast unit tests for core logic

Stage 3, component smoke:

- parse, downsample, lap detection on Pack A

Stage 4, integration:

- API and DB tests, access control, deletion flows

Stage 5, optional:

- UI e2e smoke for critical flow, run nightly

Stage 6, perf smoke:

- basic perf checks on Pack A

### 13.2 Release readiness gates

Alpha:

- all smoke tests pass
- no known failing edge-case dataset in Pack B without documented waiver
- deletion and privacy tests pass

Beta:

- nightly Pack B regression stable for 2 weeks
- load test passes target concurrency
- fuzz tests run and no crashers

## 14. Test data storage and governance

- Synthetic dataset packs live in repo under
  `ingestion/tests/fixtures/telemetry/synth/` (Pack A, B, C). See
  `docs/telemetry/Design/Telemetry_Seed_Data_Guide.md`. Larger packs may use
  versioned object storage.
- Every dataset pack is versioned and checksummed
- Provide a “dataset manifest” that lists all included datasets and expected
  ranges
- Do not store real user telemetry in repo
- For real anonymised datasets:
  - require consent
  - apply coordinate redaction where appropriate
  - store in restricted access bucket

## 15. Implementation checklist

- [x] Build synthetic dataset generator with seeded determinism
  (`ingestion/scripts/generate-telemetry-seed.py`)
- [x] Define track templates and ground truth descriptors
  (Cormcc KML in `ingestion/tests/fixtures/telemetry/track-templates/`)
- [x] Generate Pack A dataset pack (cormcc-clean-position-only)
- [ ] Expand to Pack B dataset pack
- [ ] Implement golden fixture tests for parsers
- [ ] Implement lap, segment, corner tests against ground truth
- [ ] Implement fusion tests with numeric tolerance thresholds
- [ ] Add property-based and fuzz testing harness
- [ ] Add fault injection tests for queue and storage
- [ ] Add privacy log scanning tests
- [ ] Add deletion cascade tests
- [ ] Integrate into CI with staged execution and regression baselines

## 16. Future evolutions

- Expand track template library by layout class, including indoor carpet and
  on-road
- Add physics-based vehicle dynamics for more realistic IMU signatures
- Add automated classifier tests using synthetic format variations
- Add “challenge datasets” that intentionally break assumptions to harden
  algorithms
- Add continuous monitoring: compare production run stats to synthetic baselines
  to detect anomalies
