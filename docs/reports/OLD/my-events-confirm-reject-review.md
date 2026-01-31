# My Events Confirm/Reject Workflow Review

**Report Date:** 2026-01-17  
**Last Reviewed:** 2026-01-21  
**Area:** `src/app/(authenticated)/dashboard/my-event/page.tsx` & related APIs  
**Focus:** Table interactions + Confirm/Reject flow reliability

---

## Executive Summary

The My Events table surfaces fuzzy-matched events and lets drivers confirm or
reject participation. A focused review of this workflow uncovered four defects
spanning the UI and API layers. Collectively they explain why confirmation often
"fails" or leaves the page in a broken state.

---

## Findings

### 1. Bulk Confirm/Reject silently ignore HTTP failures (UI bug)

- **Evidence:** `src/app/(authenticated)/dashboard/my-event/page.tsx`
  `handleBulkConfirm` (lines 321-358) and `handleBulkReject` (lines 360-397)
  build fetch promises and immediately `await Promise.all(...)` (lines 341
  and 380) without checking `response.ok`. A 400/500 status still resolves the
  fetch promise, so no error is raised or shown.
- **Impact:** Users see the "Confirm All"/"Reject All" buttons complete
  instantly, but individual matches can remain suggested/rejected because the
  backend refused some updates. There is no retry or error feedback, so the
  table appears buggy/inconsistent.
- **Recommendation:** After each fetch, inspect `response.ok` (and parse the
  JSON body once) before resolving. Abort the batch on the first failure,
  surface the failing event ID/message, and only refresh the list when every
  request succeeded.

### 2. `/api/v1/users/me/driver-links/events/[eventId]` returns raw 500s that the UI cannot parse (API bug)

- **Evidence:** `src/app/api/v1/users/me/driver-links/events/[eventId]/route.ts`
  PATCH handler (lines 20-48) forwards to `handleDriverLinkStatusPatch` without
  a `try/catch`. When `updateDriverLinkStatusByEvent` throws (e.g., no matching
  link), Next.js emits its default HTML error page. In contrast, the
  `/users/[userId]/...` route properly wraps the call in a `try/catch` at lines
  96-121.
- **Impact:** The client code at
  `src/app/(authenticated)/dashboard/my-event/page.tsx` (lines 253-257 and
  295-298) unconditionally calls `response.json()` when `!response.ok`. With the
  current API behavior the body is HTML, so parsing throws, the catch block
  reports a generic "Failed to confirm/reject link", and the UI flips into the
  unrecoverable error state described below.
- **Recommendation:** Mirror the guarded implementation used in
  `src/app/api/v1/users/[userId]/driver-links/events/[eventId]/route.ts` (lines
  96-121)—wrap the call, feed the error into `handleApiError`, and return a JSON
  error envelope so the client can display a meaningful message.

### 3. Error state never clears after a single failure (UI bug)

- **Evidence:** The component sets `setError(...)` inside every catch (lines
  272, 311, 354, 393), but the only place that resets it to `null` is the
  initial data fetch (line 138). Rendering the table requires `!error` (line
  558: `{!loading && !error && events.length > 0 && (`), so once any
  confirm/reject call fails the list disappears permanently until a full page
  reload.
- **Impact:** A transient network/API hiccup bricks the entire My Events page;
  users can no longer take action or even see already confirmed events. This
  reinforces the perception that the confirm/reject buttons are "broken".
- **Recommendation:** Clear `error` before starting each action (or make the
  alert dismissible) so the table reappears after a successful retry. Consider
  tracking per-action errors separately from the page-level fetch failure.

### 4. Expected "not found" scenarios return 500 instead of documented 404 (API/spec mismatch)

- **Evidence:** `updateDriverLinkStatusByEvent` throws
  `new Error("No driver link found for this user and event")` at line 447 when
  it cannot locate an `EventDriverLink`/`EventEntry`
  (`src/core/users/driver-links.ts`). Similarly, `updateDriverLinkStatus` throws
  at line 257 for missing driver links. `handleDriverLinkStatusPatch` (lines
  44-94) has no `try/catch` around the `updateDriverLinkStatusByEvent` call at
  line 85. Documentation promises a `NOT_FOUND (404)` for this case
  (`docs/api/api-reference.md` lines 2478-2483).
- **Impact:** When the ingestion data is stale (event deleted, link already
  removed, etc.), the API violates its contract and the UI receives a misleading
  "internal error". Combined with Finding #2, this frequently manifests as the
  HTML/parse failure noted above.
- **Recommendation:** Detect missing link/entry conditions explicitly and return
  `errorResponse("NOT_FOUND", ...)` so callers can show a friendly "This match
  no longer exists" message. Apply the same handling in the `/users/me` shim
  once its error handling is fixed.

---

## Next Steps

1. Patch the `/users/me` endpoint to wrap `handleDriverLinkStatusPatch` with the
   standard error handling stack so JSON errors always reach the client.
2. Update `updateDriverLinkStatusByEvent` (or the handler) to convert missing
   data into a 404 per the API spec.
3. Harden the My Events page: clear `error` on each action, add per-action
   alerts, and make the bulk actions validate each response before reporting
   success.

Addressing these items should eliminate the stuck error state and make
confirm/reject outcomes deterministic for users.

---

## Review History

| Date       | Reviewer | Notes                                                                                                                                                   |
| ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-01-21 | Claude   | Verified all findings against codebase. Updated line number references to match current code. All four defects confirmed as accurate and still present. |
