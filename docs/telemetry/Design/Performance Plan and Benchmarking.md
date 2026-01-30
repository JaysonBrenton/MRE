# Performance Plan and Benchmarking

Author: Jayson Brenton  
Date: 2026-01-30  
Purpose: Define the performance budgets, measurement approach, benchmarking
harness, and optimisation plan for MRE telemetry ingestion, processing, and
analytics workflows, across UI, API, storage, and worker pipelines.  
License: Proprietary, internal to MRE

## 1. Scope

This document defines:

- Performance budgets and service level objectives (SLOs) for MRE
- A measurement and telemetry plan for timings, resource usage, and regressions
- Benchmark datasets and workloads for realistic RC telemetry usage
- A reproducible benchmarking harness and reporting format
- Optimisation strategies and scaling milestones

Out of scope:

- Exact cloud sizing and cost modelling, except where it impacts perf targets
- Detailed code-level micro-optimisations, beyond planned hotspots
- CDN configuration, beyond general guidance

## 2. Design goals

- Keep the product fast and responsive for typical RC sessions
- Ensure processing results appear quickly and progress is visible
- Prevent performance regressions via automated benchmarking
- Scale linearly with session size and concurrent users
- Make performance data explainable and actionable

## 3. Performance budgets and SLOs

### 3.1 UI performance budgets

Budgets align to house rules:

- **P50 UI interaction**: ≤ 300ms
- **P95 UI interaction**: ≤ 800ms

UI interaction definition:

- A user action that requires a network call and re-render, for example:
  - open session detail
  - switch lap
  - apply a filter
  - render a chart viewport

Additional UI budgets:

- Initial page load on broadband: ≤ 2.5s P50, ≤ 4.0s P95
- Chart pan and zoom with cached data: ≤ 100ms P50, ≤ 250ms P95
- Time to first meaningful paint after navigation: ≤ 800ms P50

### 3.2 API performance budgets

- **Simple API reads**: ≤ 400ms P95
- Typical endpoints in this class:
  - session list
  - session metadata
  - lap list
  - downsample index and chunk fetch

Write budgets:

- Append telemetry event: ≤ 500ms P95
- Create session metadata: ≤ 600ms P95

### 3.3 Pipeline processing budgets

Define “time to usable” as primary UX metric.

For a typical 10 minute 1/8 off-road run:

- Time to path preview (parsed and L1 downsample): ≤ 20s P50, ≤ 60s P95
- Time to lap table (if quality supports): ≤ 40s P50, ≤ 120s P95
- Time to fused pose (if server fusion enabled): ≤ 60s P50, ≤ 180s P95
- Time to full publish: ≤ 120s P50, ≤ 300s P95

For large sessions, budgets scale by data size class, defined later.

### 3.4 Data size classes

Classify sessions for benchmarking and admission control:

- **S**: ≤ 10 minutes, GNSS 10 Hz, no IMU, ≤ 10k samples
- **M**: 10 to 30 minutes, GNSS 10 Hz, IMU 100 Hz, ≤ 200k IMU samples
- **L**: 30 to 90 minutes, GNSS 10 to 25 Hz, IMU 200 Hz, ≤ 1M IMU samples
- **XL**: > 90 minutes or multi-file with high rate sensors

Budgets apply to S and M as default. L and XL are expected to degrade gracefully
and may require background completion.

## 4. End to end performance measurement plan

### 4.1 What must be measured

MRE must measure:

- UI interaction timings (client-side)
- API request latencies (server-side and client-visible)
- Database query timings and row counts
- Object storage read and write timings and bytes
- Worker job durations by job type and stage
- Queue wait times, claim times, retry rates
- Memory and CPU usage for worker jobs, especially fusion and parsing

### 4.2 Correlation identifiers

All measurements must be correlated via:

- `session_id`
- `processing_run_id`
- `job_id`
- `request_id`
- `anonymous_user_id` and `anonymous_session_id` for analytics

These IDs must not include personal data and must not include location traces.

### 4.3 Required telemetry events

Client events:

- `ui_nav_start`, `ui_nav_end`
- `ui_chart_render_start`, `ui_chart_render_end`
- `ui_chunk_fetch_start`, `ui_chunk_fetch_end`
- `ui_error`

Server API events:

- `api_request_start`, `api_request_end`
- `db_query_timing` (aggregated per request, not per row logging)
- `storage_read_timing`, `storage_write_timing`

Pipeline events:

- `job_queued`, `job_started`, `job_succeeded`, `job_failed`, `job_retry_wait`
- `job_io_stats` (bytes read, bytes written)
- `job_resource_stats` (cpu seconds, peak rss)

All events must be structured and avoid Restricted telemetry values.

## 5. Benchmarking strategy

### 5.1 Principles

- Benchmarks must be deterministic and reproducible
- Benchmarks must use representative RC workloads
- Benchmarks must report percentiles and not just averages
- Benchmarks must be automated and run on every significant change

### 5.2 Benchmark environments

Define three environments:

1. **Dev local**  
   Single machine, no network variability. Useful for micro-benchmarks.

2. **CI benchmark**  
   Controlled compute. Measures regressions in code changes.

3. **Staging perf**  
   Production-like. Measures realistic end-to-end performance with network and
   storage.

Benchmarks must record environment metadata:

- CPU model, cores
- RAM
- Disk type
- OS
- container or VM details
- versions of dependencies

### 5.3 Workload types

Benchmarks cover:

- Ingestion and parsing
- Downsampling generation
- Fusion, if enabled
- Lap, segment, corner detection
- API reads of charts and lap tables
- UI flows, synthetic and real browser runs

### 5.4 Dataset design

Use a combination of:

- **Synthetic datasets** generated by a track simulator, for repeatability
- **Anonymised real datasets** where available, with user consent
- **Edge-case synthetic datasets** for failure modes and worst cases

Datasets must be tagged with:

- size class (S, M, L, XL)
- sensor profile:
  - GNSS only
  - on-board fused pose
  - GNSS plus raw IMU
- noise profile:
  - low noise
  - high jitter
  - dropout heavy
- track type:
  - typical 1/8 off-road layout
  - high-speed flowing layout
  - tight technical layout

Dataset format:

- store raw artifact files plus a metadata JSON descriptor:
  - expected lap count range
  - expected approximate lap time distribution
  - expected total duration
  - known ground truth start finish line in local coords for some synthetic
    cases

## 6. Benchmark harness design

### 6.1 CLI harness

Provide a single CLI tool, for example `mre-bench`, that can:

- load a dataset pack
- run specific pipeline stages or full pipeline
- run N iterations
- capture timings, CPU, memory, and IO
- output a JSON report and a human-readable summary

Capabilities:

- `mre-bench parse`
- `mre-bench downsample`
- `mre-bench fuse`
- `mre-bench detect-laps`
- `mre-bench full-run`
- `mre-bench api-read`
- `mre-bench ui-flow`

The harness must:

- pin versions and configuration
- avoid network calls unless staging mode explicitly enabled

### 6.2 Metrics captured per benchmark

For each run:

- wall clock duration per stage
- CPU time per stage
- peak memory per stage
- bytes read and written
- output row counts and chunk counts
- error codes if any
- queue wait time in pipeline mode

Percentiles computed across N runs:

- P50, P90, P95, P99

### 6.3 Reporting format

Benchmark report JSON must include:

- metadata:
  - timestamp
  - git commit hash
  - branch
  - environment descriptor
  - dataset id
  - iterations
- stage results:
  - durations
  - cpu seconds
  - peak rss
  - io bytes
- derived outputs:
  - lap count
  - segment count
  - downsample chunk count
- pass/fail evaluation against budgets

Human-readable output includes:

- table of stage P50 and P95
- total time to usable
- budget compliance summary
- top regressions compared to baseline

### 6.4 Baselines and regression detection

Baselines:

- A baseline JSON report stored per environment type
- Updated intentionally via an explicit “accept baseline” workflow

Regression thresholds:

- Fail CI if:
  - P95 worsens by > 15% for any critical stage, or
  - absolute P95 exceeds budget by > 10%

Critical stages:

- parse, downsample_L1, publish_session
- lap detection for size classes S and M

Fusion is critical only when enabled by default in product tier.

## 7. Performance hotspots and planned optimisations

### 7.1 Parsing

Risks:

- CSV parsing overhead for very large files
- Excessive allocations when creating arrays
- Date parsing overhead

Plan:

- streaming parsers where possible
- pre-allocate arrays based on row count when known
- avoid per-row object creation, use vectorised structures
- cache timestamp parsing patterns per file

### 7.2 Downsampling

Risks:

- O(N) per level per stream becomes heavy with IMU
- naive aggregation can thrash memory

Plan:

- chunk-based downsampling:
  - fixed time windows
  - incremental aggregation
  - write chunk outputs progressively
- store multi-resolution pyramid in chunked format to support viewport fetch

### 7.3 Fusion and Kalman filtering

Risks:

- high-rate IMU makes fusion compute heavy
- poor timestamp alignment causes wasted retries

Plan:

- separate worker pool for fusion jobs
- early prereq checks to skip fusion quickly when not viable
- implement efficient numeric kernels, possibly using compiled libs later
- record and reuse intermediate results if idempotency allows

### 7.4 Lap, segment, corner detection

Risks:

- expensive curvature calculations at high rates
- unstable results causing repeated recomputation

Plan:

- operate on the L0 or L1 pose stream depending on task needs
- compute geometry on resampled trajectory at a moderate rate, for example 20 Hz
  equivalent
- cache intermediate curvature arrays as derived datasets

### 7.5 API and database

Risks:

- N+1 queries for session views
- poor indexing for time-range queries
- large payloads for charts

Plan:

- add composite indexes:
  - `(owner_user_id, session_id)`
  - `(session_id, dataset_type)`
  - time-range indexes per chunk table if used
- chunked fetch endpoints:
  - request only the visible time range and resolution level
- enforce pagination and limits

### 7.6 UI performance

Risks:

- too many points rendered in charts
- slow state updates and excessive re-rendering

Plan:

- always use downsampled levels for charts
- cap rendered points per series, for example <= 5k per chart viewport
- memoise transforms and avoid deep equality checks on large arrays
- use web workers for client-side transforms if needed

## 8. Benchmarking for different device profiles

### 8.1 Devices with on-board fusion

Benchmarks must include:

- pose stream present at moderate rate
- no IMU
- check that MRE does not run server fusion
- measure lap detection and chart render performance with smoother pose

Metrics of interest:

- time to path preview should be very fast
- lower CPU for processing

### 8.2 Devices without fusion requiring Kalman

Benchmarks must include:

- GNSS plus IMU
- time alignment complexity
- full fusion stage enabled

Metrics of interest:

- fusion duration and peak memory
- percent time in degraded mode, if computed
- total time to publish

A separate budget for fusion-heavy sessions may be required for L and XL
classes.

## 9. Load testing and concurrency benchmarking

### 9.1 Target concurrency

Define initial targets:

- 25 concurrent users browsing sessions
- 10 concurrent ingestion runs
- 3 concurrent fusion jobs

These are staging targets, not final scale.

### 9.2 Load test scenarios

Scenario A: Browse heavy

- session list, session detail, lap list, chart interactions
- sustained for 15 minutes

Scenario B: Ingest heavy

- burst of uploads, queue depth increase
- workers catch up
- monitor time to usable and error rates

Scenario C: Mixed

- ingestion and browsing simultaneously, test resource contention

### 9.3 Success criteria

- API P95 stays within budgets under target concurrency
- Queue wait times do not exceed acceptable thresholds for size class S
- No error rate spike beyond 1% for normal operations
- Worker CPU remains below safe thresholds, avoiding thrash

## 10. Storage layout and caching plan for performance

### 10.1 Chunked time series storage

Use a chunking strategy for downsampled series:

- store chunks as fixed time ranges, for example 5 seconds or 10 seconds
- each chunk includes arrays for fields
- index chunks by session, stream, resolution level, start time

Benefits:

- API fetch can return only needed chunks
- UI can prefetch adjacent chunks for smooth interaction

### 10.2 Caching

Server-side caching:

- cache session metadata and lap tables for short TTL, for example 30 to 120
  seconds
- cache derived dataset manifests

Client-side caching:

- cache fetched chunks in memory with LRU eviction
- cache manifests in local storage if safe and beneficial

Rule:

- caching must respect per-user access control and must never leak across users.

## 11. Budget enforcement and guardrails

### 11.1 CI gates

CI must fail when:

- critical stage P95 exceeds budgets by defined thresholds
- regression exceeds relative threshold
- memory exceeds defined peak thresholds for a dataset size class

### 11.2 Runtime guardrails

At runtime:

- reject uploads that exceed size limits, with truthful messages
- degrade gracefully:
  - disable advanced analysis
  - process only preview downsample
  - schedule full processing later, but clearly label as pending

## 12. Benchmark schedule

- Nightly full benchmark suite on staging perf environment
- On every main merge:
  - smoke benchmark on small dataset S
  - quick API read benchmarks
- Weekly:
  - load test scenario run
  - report trends

Trends must be visible in a simple dashboard.

## 13. Observability and dashboards

Required dashboards:

- API latency percentiles by endpoint
- Worker job duration percentiles by job type
- Queue depth and wait time
- Error rates by error code
- Storage IO latency and throughput
- UI interaction timings if collected

Retention:

- raw logs 7 days
- aggregated metrics 90 days

## 14. Benchmark acceptance criteria per release

For an alpha release:

- S and M classes meet budgets for parse, downsample_L1, and lap detection
- UI chart interactions meet point rendering caps and P95 budgets
- No known performance cliff for common session lengths

For a beta release:

- fusion path meets budgets for M class
- load test scenario B passes with target concurrency
- regression gating stable and baseline updated intentionally

## 15. Implementation checklist

- [ ] Implement structured timing events across UI, API, and pipeline
- [ ] Add correlation ids everywhere
- [ ] Build `mre-bench` CLI harness with stage runners
- [ ] Create dataset packs for S, M, L, XL, with profiles
- [ ] Add CI smoke benchmark and regression thresholds
- [ ] Add staging nightly benchmarks and dashboards
- [ ] Enforce chunked downsample storage and viewport fetch endpoints
- [ ] Add UI point caps and interaction timing instrumentation

## 16. Future evolutions

- Hardware-accelerated numeric kernels for fusion and geometry
- Adaptive downsampling and dynamic level selection based on viewport
- Multi-tenant performance isolation via separate worker pools
- Cost-aware scheduling, shift heavy compute to off-peak windows
- Automated root cause analysis for performance regressions
