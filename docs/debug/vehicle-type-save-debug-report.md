# Vehicle Type Save – Debug Report

**Date:** 2026-01-23  
**Context:** Race Class Details modal → save inferred vehicle type → "does not
seem to save to DB and/or refresh UI"

---

## 1. Flow Summary

### 1.1 UI → API → DB

| Step | Location                      | Behavior                                                                                                                                     |
| ---- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `ClassDetailsModal`           | User edits Vehicle Type dropdown, clicks **Save** (or **Accept Inference**).                                                                 |
| 2    | `handleSave` / `handleAccept` | Calls `onSave(vehicleType, acceptInference)` and then `onClose()` (only if no throw).                                                        |
| 3    | Parent `onSave`               | `fetch` PUT to `/api/v1/events/{eventId}/race-classes/{encodeURIComponent(className)}/vehicle-type` with `{ vehicleType, acceptInference }`. |
| 4    | On `!response.ok`             | Throws `"Failed to save vehicle type"` → modal shows error, no reload.                                                                       |
| 5    | On `response.ok`              | `window.location.reload()` → full page refresh.                                                                                              |
| 6    | API `PUT`                     | Uses `updateVehicleType` from `@/core/events/update-vehicle-type`.                                                                           |
| 7    | Core                          | `prisma.eventRaceClass.upsert` by `eventId` + `className`, then `eventEntry.updateMany` to set `eventRaceClassId`.                           |

### 1.2 Where the modal is used

- **EventAnalysisSidebar** – class selector / “Needs Review” →
  `ClassDetailsModal`, `onSave` → fetch + `window.location.reload()`.
- **ChartControls** (Overview tab) – same pattern.
- **EntryList** (Entry List tab) – row click → same pattern.
- **OverviewTab** – has its own `ClassDetailsModal` and `modalOpen` /
  `modalClassName` state, but **never sets them**. That modal is never opened;
  the one the user sees on Overview is ChartControls’.

---

## 2. DB & API Check

### 2.1 Schema

- **`EventRaceClass`**: `@@unique([eventId, className])`, `vehicleType`,
  `vehicleTypeNeedsReview`, etc. Matches `update-vehicle-type` usage.
- **`EventEntry`**: `eventId`, `className`, `eventRaceClassId`. `updateMany`
  filters by `eventId` + `className` and sets `eventRaceClassId` → correct.

### 2.2 API

- **PUT** auth, params, and `vehicleType` checks look correct.
  `vehicleType === undefined` → 400; `null` is allowed.
- **`updateVehicleType`**: upsert on `eventId_className`, then `updateMany` on
  `EventEntry`. No obvious logic bugs.

### 2.3 Analysis data source

- **`getEventAnalysisData`** builds `raceClasses` from
  `prisma.eventRaceClass.findMany({ where: { eventId } })` → same store that PUT
  updates.
- **Dashboard** loads analysis via `fetchEventAnalysisData` →
  `GET /api/v1/events/:id/analysis` → `getEventAnalysisData`. No persist of
  `analysisData`; only `selectedEventId` is persisted.

So: **if the PUT succeeds and the page reloads, the next analysis fetch should
return updated vehicle types.**

Conclusion: **DB and API wiring are consistent with “save + reload” working**,
provided the PUT succeeds and the reload actually happens.

---

## 3. Issues Identified

### 3.1 **Reload-only refresh (design)**

- **Behavior:** After save, the UI updates **only** via
  `window.location.reload()`. There is no Redux dispatch, no
  `fetchEventAnalysisData`-after-save, no incremental update.
- **Impact:** If reload never runs (e.g. fetch fails, or user navigates/closes
  before it completes), the UI will not reflect the save even when the DB was
  updated.
- **Recommendation:** On successful PUT, either keep `window.location.reload()`
  **or** switch to dispatching `fetchEventAnalysisData` and then closing the
  modal (and avoid full reload). Document the chosen strategy.

### 3.2 **Generic error message**

- **Behavior:** `onSave` checks `!response.ok` and throws
  `"Failed to save vehicle type"`. The response body (API error code/message) is
  not read or shown.
- **Impact:** User cannot tell if the failure is 401, 400, 500, or network
  error. Harder to debug.
- **Recommendation:** Parse `response.json()` on error, surface `error?.message`
  or `error?.code` in the modal (e.g. in `setError`), and log the full response
  in dev.

### 3.3 **Modal close during save**

- **Behavior:** Modal can be closed by backdrop click or Escape. `onClose` is
  `handleCancel` → `setModalOpen(false)` etc. Save runs in parent `onSave`
  (fetch + reload). Buttons are `disabled={isSaving}`; **backdrop and Escape are
  still active**.
- **Impact:** User can click Save, then immediately dismiss the modal. Fetch
  continues. If it **fails**, the promise rejects in the parent `onSave`. The
  modal has already unmounted, so `setError` / `setIsSaving(false)` run on an
  unmounted component (React warning), and the user never sees the error. They
  may assume “nothing happened.”
- **Recommendation:** While `isSaving`, either prevent backdrop/Escape close
  (e.g. `onClose` no-op when `isSaving`) or keep the modal mounted until the
  save promise settles (e.g. by not closing on backdrop/Escape during save).

### 3.4 **OverviewTab modal dead code**

- **Behavior:** OverviewTab defines `modalOpen`, `modalClassName`, and a
  `ClassDetailsModal`, but **never** calls `setModalOpen(true)` or
  `setModalClassName(...)`. The Overview tab’s class-details modal is actually
  in ChartControls.
- **Impact:** Dead code only; no direct impact on the reported bug.
- **Recommendation:** Remove the unused OverviewTab modal state and
  `ClassDetailsModal`, or wire it up and use it instead of ChartControls’ modal
  (then remove the duplicate there).

### 3.5 **No `credentials` or cache handling**

- **Behavior:**
  `fetch(..., { method: "PUT", headers: { "Content-Type": "application/json" }, body: ... })`
  — no `credentials: "include"` or `cache: "no-store"`.
- **Impact:** Same-origin requests send cookies by default, so auth usually
  works. Unlikely to be the root cause unless you have nonstandard setup.
  Explicit `credentials: "include"` and `cache: "no-store"` would make behavior
  clearer and avoid any cache surprises.

---

## 4. Most Likely Causes of “Does Not Save / Refresh”

Given the codebase:

1. **PUT fails (4xx/5xx or network)**
   - User sees “Failed to save vehicle type” **only if** the modal is still open
     when the error is thrown.
   - If they close the modal (backdrop/Escape) during save, they get no feedback
     and may report “doesn’t save” even when the failure is on the client/API
     side.

2. **Reload never runs**
   - If `onSave` throws (e.g. `!response.ok`), we never call
     `window.location.reload()`.
   - So “does not refresh” is expected whenever the PUT is treated as failed.

3. **DB actually updated, but user expects in-modal refresh**
   - Current design only refreshes via full reload. If reload is skipped (e.g.
     error path) or user expects the modal to update without a full refresh,
     that could match “does not refresh appropriately.”

---

## 5. Recommended Next Steps

1. **Reproduce with DevTools**
   - Open Network tab.
   - Open Race Class Details modal, change vehicle type, click Save.
   - Check:
     - Is the PUT sent? (URL, body, `eventId` / `className`.)
     - Status code (200 vs 4xx/5xx)?
     - Response body if not 200.

2. **Check DB after “Save”**
   - Run:
     ```sql
     SELECT id, event_id, class_name, vehicle_type, vehicle_type_needs_review
     FROM event_race_classes
     WHERE event_id = '<eventId>' AND class_name = '<className>';
     ```
   - Before vs after a Save. If the row appears/updates, the backend is
     persisting.

3. **Improve error handling**
   - In `onSave`, on `!response.ok`: parse `response.json()`, use
     `error?.message` (or similar) in the modal error state, and log the full
     response.
   - Reduces guesswork when something fails.

4. **Tighten modal behavior during save**
   - Disable backdrop close and Escape while `isSaving`, or otherwise ensure the
     modal stays open until save completes/fails so the user always sees success
     or error.

5. **Optional: avoid full reload**
   - On success, call `dispatch(fetchEventAnalysisData(eventId))`, then
     `onClose()`, and remove `window.location.reload()`. Reduces impact of
     reload vs soft-nav edge cases.

---

## 6. Files Touched in This Review

| File                                                                             | Role                                                    |
| -------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `src/components/event-analysis/ClassDetailsModal.tsx`                            | Modal UI, `handleSave` / `handleAccept`, `onSave` usage |
| `src/app/api/v1/events/[eventId]/race-classes/[className]/vehicle-type/route.ts` | GET/PUT vehicle type API                                |
| `src/core/events/update-vehicle-type.ts`                                         | `updateVehicleType`, `getVehicleType`                   |
| `src/core/events/get-event-analysis-data.ts`                                     | `raceClasses` from `EventRaceClass`                     |
| `src/store/slices/dashboardSlice.ts`                                             | `fetchEventAnalysisData`, persist config                |
| `src/store/index.ts`                                                             | Dashboard persist whitelist: `selectedEventId` only     |
| `src/components/dashboard/EventAnalysisSection.tsx`                              | Analysis fetch, use of `transformedData`                |
| `src/components/event-analysis/OverviewTab.tsx`                                  | Unused modal state + `ClassDetailsModal`                |
| `src/components/event-analysis/ChartControls.tsx`                                | ChartControls `ClassDetailsModal` + `onSave`            |
| `src/components/event-analysis/EntryList.tsx`                                    | EntryList `ClassDetailsModal` + `onSave`                |
| `src/components/event-analysis/EventAnalysisSidebar.tsx`                         | Sidebar `ClassDetailsModal` + `onSave`                  |
| `prisma/schema.prisma`                                                           | `EventRaceClass`, `EventEntry`                          |
| `src/components/ui/Modal.tsx`                                                    | Backdrop / Escape close behavior                        |

---

## 7. Short Summary

- **DB and API** are aligned with “upsert `EventRaceClass` → update `EventEntry`
  → analysis reads from `EventRaceClass`.” No persist of analysis data; only
  `selectedEventId` is stored.
- **Likely failure modes:** PUT fails (auth, validation, or server error) **or**
  user closes the modal during save and never sees the error. The generic
  “Failed to save vehicle type” message and reload-only refresh make this harder
  to confirm.
- **Concrete improvements:** Use Network + DB checks above, then add clearer
  error handling, fix “close during save” behavior, and optionally replace full
  reload with refetch + modal close.
