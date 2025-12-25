---
created: 2025-12-23
reviewer: Codex (GPT-5)
scope: Login → Event Search → Event Analysis UX
status: Complete
relatedDocs:
  - README.md
  - docs/frontend/liverc/user-workflow.md
  - docs/design/mre-mobile-ux-guidelines.md
  - docs/specs/mre-v0.1-feature-scope.md
---

# Login → Event Data UX Review (Codex)

## Executive Summary
- The happy-path journey (sign in → find/import an event → open analysis) requires four disjoint surfaces (`/login`, `/welcome`, `/event-search`, `/dashboard`, `/events/analyse/...`). Each transition introduces friction or dead-ends, so drivers never experience the “one smooth flow” described in docs/frontend/liverc/user-workflow.md lines 29-41.
- Event Search implements core mechanics (track picker, optional date filter, server-side validation) well, but omits the manual "Check LiveRC" affordance, the LiveRC import prompt, and the mandated "Import All" flow (docs/frontend/liverc/user-workflow.md lines 286-332). Discovered events can only be imported one-by-one via the table, so the UX diverges sharply from the Alpha contract.
- Selecting an event does not take the driver to Event Analysis. `Select` writes to `sessionStorage` and routes to `/dashboard` (src/components/event-search/EventRow.tsx:65-121), forcing the driver to click a tiny chart icon to finally open `/events/analyse/...`. This indirection breaks the documented navigation contract (docs/frontend/liverc/user-workflow.md lines 535-551) and blocks sharable, deterministic URLs.
- Event Analysis itself ships only two of the four required tabs. `EventAnalysisClient` purposely hides Sessions/Comparisons (src/app/events/analyse/[eventId]/EventAnalysisClient.tsx:59-104), yet downstream copy still references the missing Comparisons tab (src/components/event-analysis/DriversTab.tsx:35-57). The experience feels unfinished just as the driver reaches the “hero moment”.

## Detailed Journey Review & Recommendations

### 1. Sign-In → Welcome
- **Redirect stalls the journey.** After a successful login, non-admins are always pushed to `/welcome` (src/app/login/page.tsx:101-148). The welcome page is a static greeting with no CTA pointing drivers to Event Search (src/app/welcome/page.tsx:38-49), so the prescribed step 2 (“Driver navigates to Event Search”) relies entirely on the user noticing the nav rather than being guided. *Recommendation:* Redirect directly to `/event-search` for non-admins or add a focused "Start searching for events" CTA on the welcome view to keep momentum.

### 2. Dashboard Orientation
- **“Import an event” points to the wrong surface.** The dashboard’s primary CTA goes to `/events` (src/app/dashboard/page.tsx:43-63), which only lists already-imported events (src/components/events/EventsPageClient.tsx:59-168). Drivers looking to ingest new LiveRC data get stranded without a link back to Event Search. *Recommendation:* Point the CTA to `/event-search`, and make `/events` emphasize that it is a read-only history list with a button to discover/import more events.

### 3. Event Search Entry & Track Selection
- **Modal accessibility gap.** The workflow doc requires the track modal to trap focus and announce itself (docs/frontend/liverc/user-workflow.md lines 150-181). `TrackSelectionModal` sets ESC handling and autofocus, but there is no focus trap—pressing Tab immediately escapes to the page underneath (src/components/event-search/TrackSelectionModal.tsx:56-154). *Recommendation:* Add focus-trap logic (e.g., sentinels or `focus-trap-react`) so keyboard users are not lost mid-selection.
- **Favourites not surfaced outside the modal.** The document calls out optional "favourite chips above the form" for quick re-selection (docs/frontend/liverc/user-workflow.md lines 120-149). Today favourites are only visible inside the modal, so the value of starring tracks is limited. *Recommendation:* render favourite chips (read-only) beside the Track button to reduce taps for frequent tracks.

### 4. LiveRC Discovery & Import
- **Missing "Check LiveRC" CTA.** The spec mandates a visible button so drivers can manually query LiveRC even when DB results exist (docs/frontend/liverc/user-workflow.md lines 310-317). Although `checkLiveRC()` exists and there is even a dedicated `CheckLiveRCButton` component, nothing in `EventSearchContainer` or `EventSearchForm` renders it (src/components/event-search/EventSearchContainer.tsx:301-525, src/components/event-search/CheckLiveRCButton.tsx:19-33). Drivers therefore cannot re-check LiveRC without re-running the whole search. *Recommendation:* Place the button above the table, show an inline "Checking LiveRC..." state (per doc line 316), and wire it to `checkLiveRC`.
- **No LiveRC import prompt / Import-All affordance.** When new events are discovered, the UX should show "We found X new events ... Import all now?" and only allow bulk import (docs/frontend/liverc/user-workflow.md lines 325-332). We ship an `ImportPrompt` component (src/components/event-search/ImportPrompt.tsx:20-71) but never mount it. Instead, each `EventRow` exposes an individual "Import" button (src/components/event-search/EventRow.tsx:99-111). This contradicts the Alpha contract and makes large batches painful. *Recommendation:* revive `ImportPrompt`, track `newEventsFromLiveRC`, and expose a single "Import All" action that queues all discoveries with one tap.
- **Status model incomplete.** Event Status badges support `stored|imported|new|importing|failed`, yet the table only ever renders `imported` or `new` because status is derived solely from `ingestDepth` (src/components/event-search/EventRow.tsx:65-123). There is no transition to `importing` when a job starts, no `failed` badge, and the toast never announces "Import started" as required (docs/frontend/liverc/user-workflow.md lines 353-360). *Recommendation:* Maintain per-event status in component state (e.g., `importingIds`, `failedIds`) and set the proper badge + toast strings so the workflow mirrors the documented status ladder.

### 5. Event Selection & Navigation
- **Button label + destination mismatch.** Docs insist on an "Analyse event" button that navigates straight to Event Analysis (docs/frontend/liverc/user-workflow.md lines 535-551). Our button is labeled "Select" and stashes the event ID in `sessionStorage` before routing to `/dashboard` (src/components/event-search/EventRow.tsx:65-121, src/components/dashboard/DashboardClient.tsx:21-141). This adds an extra screen, breaks refresh/linkability, and forces the user to find a small chart icon (src/components/dashboard/EventOverview.tsx:60-68) to actually open analysis. *Recommendation:* replace the `Select` button with "Analyse event" that links directly to `/events/analyse/${eventId}`; optionally keep the dashboard summary as a secondary entry point.
- **No confirmation that an event was selected.** Because the table disappears while `handleSearch()` re-runs post-import (src/components/event-search/EventSearchContainer.tsx:319-403), drivers receive no inline message like "Event ready – opening analysis". *Recommendation:* show a toast or inline banner after import/selection so the driver understands what just happened, especially if you keep any intermediate redirects.

### 6. Event Analysis Experience
- **Missing tabs at the hero moment.** `EventAnalysisClient` deliberately filters the tab list down to Overview + Drivers (src/app/events/analyse/[eventId]/EventAnalysisClient.tsx:59-86), even though docs/frontend/liverc/user-workflow.md lines 615-633 require Sessions/Heats and Comparisons as first-class tabs. To make matters worse, the Drivers tab copy invites users to “Select drivers to compare in the Comparisons tab” (src/components/event-analysis/DriversTab.tsx:35-57), but that tab is unreachable. *Recommendation:* render the full tab set immediately—even if Sessions/Comparisons are placeholder panels with roadmap notes—so the navigation surface matches documented expectations.
- **Shareability and resilience.** Relying on `sessionStorage` to carry the selected event from Event Search to Dashboard means a fresh tab, different device, or cleared storage loses the context. While `/events/analyse/[eventId]` does load data directly (src/app/events/analyse/[eventId]/page.tsx:1-62), the current flow hides that capability. *Recommendation:* emphasize deep links (copy the URL, share with a teammate) so imported data feels tangible.

### 7. Login Redirect Complexity
- **Client-side redirect logic is brittle.** `src/app/login/page.tsx:88-148` re-fetches the session, branches on `isAdmin`, and issues multiple `router.push` calls after `authenticate()` already triggers the NextAuth redirect pipeline. Every failure path ends up dumping the user on `/welcome`, which is a dead-end, and the extra network call slows the transition to the core workflow. *Recommendation:* let the server action or NextAuth middleware own the redirect (e.g., return a flag from `authenticate()` and call `redirect("/event-search")` for drivers) so the login step becomes deterministic and faster.

### 8. Navigation + Browse Surfaces
- **Navbar never signals where you are.** `AuthenticatedNav` renders identical link styles for `/dashboard` and `/event-search` (src/components/AuthenticatedNav.tsx:41-57), so users have no visual confirmation that they are on the right surface. Add `usePathname()`-driven active styling (accent underline, filled chip) and consider adding `/events` so the read-only catalogue is reachable without hunting the dashboard CTA.
- **Imported-events list strand new users.** When `/events` responds with zero rows, drivers see the static "No imported events found." copy (src/components/events/EventsPageClient.tsx:122-166) and no affordance to start importing. Mirror the Event Search CTA here (“Search for events”) so this surface reinforces the relationship between “discover/import” and “browse imported” instead of acting as another dead-end.

### 9. Breadcrumbs & Contextual Back Links
- **Deep pages feel orphaned.** Neither `/events/analyse/[eventId]` nor `/events` expose breadcrumb navigation or even a “Back to event list” link, so once a driver drills into analysis there is no obvious route back to the catalogue or Event Search (docs/frontend/liverc/user-workflow.md lines 535-551 expect a clear path). Add a breadcrumb component to `EventAnalysisHeader` showing `Dashboard > Events > {Event Name}` and wire the first two nodes to `/dashboard` and `/events` respectively; mirror the same pattern on other nested pages so users always see where they are in the hierarchy.

### 10. Registration Feedback Loop
- **Auto-login fallback is silent.** When registration succeeds but the subsequent `signIn` call throws, `src/app/register/page.tsx:152-172` redirects to `/login?registered=true` without surfacing any messaging on the login form. That leaves new drivers guessing whether registration actually worked. Update `LoginPage` to read the query string and show a “Registration successful—please sign in” alert, or retry the sign-in with clearer error reporting so the onboarding loop feels intentional.

### 11. Dashboard Momentum
- **No “continue where you left off”.** After selection/import, the dashboard forgets the user’s recent events entirely until sessionStorage happens to supply one. Following the Cursor review, add a “Recent events” section that lists the last few imported/analysed events (fetch via `/api/v1/events?limit=3` or from the user profile) so returning drivers have a clear next action and don’t need to re-run Event Search when they simply want to reopen yesterday’s data.

## Additional Polish Ideas
1. **Post-login guidance:** add a "Start analysing events" CTA on `/welcome` and anchor `/dashboard` hero copy around the LiveRC workflow so new drivers know what to do next.
2. **Mobile sorting:** Event table headers (and therefore sorting) disappear on mobile (src/components/event-search/EventTable.tsx:70-126), while docs call for a mobile-friendly dropdown/toggle (docs/frontend/liverc/user-workflow.md lines 520-579). Provide a compact "Sort by" control so mobile users can still order by date/name.
3. **Surface favourites outside the modal:** show favourite chips beneath the Track label for one-tap reuse; this also doubles as an affordance that starring tracks matters.
4. **Inline LiveRC progress copy:** even a subtle inline message (“No database events found. Checking LiveRC...”) per doc line 286 keeps trust high while the auto discovery runs.
5. **Active navigation state:** highlight the current route inside `AuthenticatedNav` (src/components/AuthenticatedNav.tsx:41-57) so drivers immediately know whether they are browsing the dashboard, search, or events catalogue.
6. **Actionable `/events` empty state:** extend `EventsPageClient` (src/components/events/EventsPageClient.tsx:122-166) with a “Search for events” button + explanatory copy when no imports exist, guiding users back to the ingestion workflow instead of leaving them at a dead-end grid.

Addressing the above will make the login→analysis journey feel intentional, reduce redundant clicks, and keep us aligned with the Alpha guardrails captured in docs/frontend/liverc/user-workflow.md.
