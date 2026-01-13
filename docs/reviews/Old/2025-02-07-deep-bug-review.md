# Deep Bug Review – Follow-up Verification (2025-02-07)

All previously reported items were re-tested. The fixes below are confirmed in the current repository state.

## Front-End

- **Automatic background ingestion on every search result – Resolved**  \
  `src/components/event-search/EventSearchContainer.tsx:207-248`  \
  `checkImportInProgress` now issues a read-only `GET /api/v1/events/{id}` call instead of posting to the ingest endpoint. Viewing results no longer queues ingestion jobs; POST requests only occur inside the explicit `importEvent` path.

- **Polling loop replays the entire search for every importing event – Resolved**  \
  `src/components/event-search/EventSearchContainer.tsx:1252-1400`  \
  Each polling interval now targets the lightweight `/api/v1/events/{id}` route, tracks consecutive errors, and clears itself when complete. The previous expensive `/api/v1/events/search` fan-out no longer runs per interval.

- **Weather widget races updates when switching events – Resolved**  \
  `src/components/dashboard/DashboardClient.tsx:108-181`  \
  Weather fetches are wrapped in an `AbortController` and guard against stale responses before mutating state. Rapid event switches no longer surface mismatched data.

## Back-End

- **`/welcome` guard treats every session as anonymous – Resolved**  \
  `middleware.ts:167-201`  \
  The middleware now calls `await auth()` (without passing the request) for the `/welcome` short-circuit, so authenticated sessions reach the correct admin/user redirects.

- **NextAuth authorization responses are discarded – Resolved**  \
  `middleware.ts:203-234`  \
  When `auth(request)` returns a `Response`, the middleware wraps it with `NextResponse.from` and returns it directly—preserving redirects, headers, and cookies instead of overriding them with `NextResponse.next()`.

- **Every log call writes synchronously to Prisma – Resolved**  \
  `src/lib/logger.ts:1-205` `src/lib/logger.ts:296-349`  \
  Logging now uses a buffered `LogBuffer` that batches writes via `createMany` on a timer/max-size threshold. Routine `info`/`debug` logs no longer incur synchronous Prisma writes.

- **`getAllImportedEvents` cannot actually sort by track name – Resolved**  \
  `src/core/events/repo.ts:324-389`  \
  Track-name ordering now uses Prisma’s nested `orderBy` (`{ track: { trackName } }`) with a secondary sort, so pagination happens in the requested order and the in-memory re-sort has been removed.

## Status

All previously reported findings are addressed. No new regressions were observed during this follow-up pass.
