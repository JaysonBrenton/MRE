---
created: 2026-05-31
status: Proposed
deciders: Engineering, Platform
---

# ADR-20260531 — Scheduled auto-ingest of recent LiveRC events

## Context

Since v0.1, MRE ingestion policy (see
[01-overview.md](../architecture/liverc-ingestion/01-overview.md)) has stated
that **events are not scraped automatically** — only the track catalogue is
proactively synced; event metadata and lap data are fetched on admin or user
demand.

In production we already run **nightly followed-track metadata refresh**
(`refresh-followed-events --depth none` at 00:30 UTC). That job discovers events
but does **not** ingest races, results, or laps. Operators and users must
manually trigger full ingestion for new club meetings to appear with analysis
data.

Product need: **followed tracks** should gain full lap data within ~24 hours of
LiveRC publishing results, without manual CLI runs, while respecting LiveRC
courtesy limits and MRE cost controls.

## Decision

1. Add a **new CLI command** `refresh-recent-events` and a **separate cron job**
   (default **02:00 UTC**) that:
   - Scans a configurable track scope (v1 default: **`followed` +
     `is_active`**).
   - Upserts event metadata from LiveRC (same as existing refresh path).
   - Automatically runs **`laps_full`** ingestion only for events whose dates
     fall in a **recency window** (default **7 calendar days**), subject to
     eligibility rules, caps, and kill switches.

2. **Keep** the existing **00:30 UTC** `refresh-followed-events --depth none`
   job unchanged. Metadata-only refresh remains cheap and useful for search UX;
   recent auto-ingest is **complementary**, not a replacement.

3. **Do not** change user-initiated on-demand ingestion. Historical backfill and
   non-recent events continue to use `refresh-events`, `ingest-event`, or UI/API
   triggers.

4. **Safety defaults (v1):**
   - Feature **disabled** until `MRE_RECENT_EVENTS_AUTO_INGEST_ENABLED=true`.
   - Global **`MRE_SCRAPE_ENABLED`** kill switch honored (same as other cron).
   - Default caps: **50** full ingests per run, **5** per track.
   - Default **`--min-event-age-hours 12`** to skip in-progress meetings.
   - No re-ingest of events already at `laps_full` unless `--re-ingest-stale`
     (admin-only, not used by cron).
   - Sequential track processing; **0–120 s jitter** before run.

5. **Normative specification:**
   [31-recent-events-auto-ingest.md](../architecture/liverc-ingestion/31-recent-events-auto-ingest.md).

## Consequences

**Positive**

- Followed-track events gain full data overnight without operator toil.
- Bounded scope (date window + caps + followed default) limits LiveRC load vs
  scanning all events on all tracks.
- Idempotent pipeline + advisory locks; safe to re-run.
- Independent enable flag allows staging rollout before production.

**Negative**

- Policy shift from “never auto-scrape events” to “auto-scrape **recent** events
  on **opt-in** schedule with caps.” Overview doc and scraping narrative must be
  updated.
- Additional nightly load on LiveRC and ingestion container (mitigated by caps).
- Risk of ingesting incomplete results if min-age filter is too aggressive or
  too lenient — requires tuning from ops feedback.

## Alternatives considered

1. **Extend `refresh-followed-events --depth laps_full` nightly** — Rejected:
   ingests **all** new events on followed tracks with **no date filter**; higher
   storage and LiveRC cost; conflates metadata refresh with deep ingest.

2. **User-triggered only (status quo)** — Rejected: does not meet freshness goal
   for followed tracks.

3. **`--tracks active` in production cron** — Rejected for v1: ~800+ list
   requests/night; staging or explicit ops approval only.

4. **Real-time polling / webhooks** — Rejected: LiveRC offers no webhook;
   polling violates courtesy and cost constraints.

## Implementation and operations

- Implementation plan:
  [recent-events-auto-ingest-2026-05.md](../implimentation_plans/recent-events-auto-ingest-2026-05.md)
- Runbook:
  [recent-events-auto-ingest-runbook.md](../operations/recent-events-auto-ingest-runbook.md)
- Canonical QA fixture: Hot Rod Hobbies event `506979` (2026-05-30).

**Status:** Proposed — pending merge of implementation Phases 1–3. Set ADR
status to **Accepted** when feature ships to production with cron enabled.

## Related

- [27-web-scraping-best-practices.md](../architecture/liverc-ingestion/27-web-scraping-best-practices.md)
- [06-admin-cli-spec.md](../architecture/liverc-ingestion/06-admin-cli-spec.md)
- [16-ingestion-concurrency-and-locking.md](../architecture/liverc-ingestion/16-ingestion-concurrency-and-locking.md)
