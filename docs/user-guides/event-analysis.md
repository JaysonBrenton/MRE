---
created: 2026-01-27
creator: Jayson Brenton
lastModified: 2026-05-13
description: Guide to analyzing race event data in My Race Engineer (current UI)
purpose:
  Documents the Event Analysis experience as embedded on My Event Analysis
  (/eventAnalysis): tabs, Event vs Session drill-downs, practice-day layouts, and
  actions that operate on the selected event.
relatedFiles:
  - src/components/organisms/dashboard/EventAnalysisSection.tsx
  - src/components/organisms/event-analysis/event-analysis-sub-tabs.ts
  - docs/frontend/liverc/user-workflow.md
---

# Event Analysis guide

The **Event Analysis experience** lives on **My Event Analysis**
(`/eventAnalysis`). After you pick an event, charts, summaries, lap tables, and
club context render directly beneath the dashboard header. Non-admin accounts
land here after sign-in; admins reach it via the left rail like any other
feature.

![Event Overview with primary tabs and summary cards](./images/my-event-analysis-overview.png)

This guide reflects the **Alpha · v0.1.0** shell (footer label on authenticated
pages).

## Prerequisites

- Signed in to MRE.
- At least one **ingested** event available (use **Actions → Find and Import
  Events** from the tab strip when an event context exists, or work with data
  your org has already imported).
- For fuzzy “my racing” linkage, configure your **driver name** and optional
  transponder in profile (see [Driver Features](driver-features.md)).

## How you open analysis

### From Global Search (`/search`)

1. Submit a query (keyword text plus optional filters).
2. Click **View Event** on a row; the app navigates to
   `/eventAnalysis?eventId=<uuid>` and selects that event.

![Search results tables with View Event links](./images/global-search-results.png)

### From My Events (navigation rail)

When you are already on `/eventAnalysis` with a **race-day** event selected, a
secondary **My Events** control appears in the rail under **My Event Analysis**.
Use it to review fuzzy matches across your driver persona; picking a row jumps
you back into the main Event Overview for that event (see
[Driver Features](driver-features.md)).

### Deep links & URL behaviour

Opening `/eventAnalysis?eventId=` selects the ID once, then the client
**removes** `eventId` from the query string while keeping your choice in Redux
(and persisted storage). Returning later restores the prior selection unless you
clear it.

## Primary tabs (race day)

Race-day programmes use four top-level tabs in the scrolling pill strip beside
**Actions**:

| Tab                  | Purpose                                                                                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Event Overview**   | Venue, contact shortcuts, headline stats/class mix mini summaries, weather, class podium previews, toggles between **Event Results** vs **Session Results** summaries. |
| **Event Analysis**   | Event-wide analysis subtabs (menus under the pill); includes ladder-oriented views such as qualification results, bump-up, and progression where data exists.          |
| **Session Analysis** | Same toolkit scoped to sessions; submenu omits ladder-only subtabs automatically.                                                                                      |
| **Entry List**       | Entry list driver table tooling (classes, normalization hints).                                                                                                        |

**Actions** exposes event operations regardless of tab:

![Actions menu](./images/event-actions-menu.png)

Typical commands:

| Item                       | Meaning                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------ |
| **Find and Import Events** | Opens the embedded discovery/import flow (`⌘E` on desktop).                                      |
| **Refresh Event Data**     | Reloads ingestion-backed summaries (`⌘⌥R`).                                                      |
| **Map car types**          | Opens the account-wide taxonomy modal (also covered in [Car type mapping](car-type-mapping.md)). |
| **Update host track**      | Correlate venue metadata shown in summaries.                                                     |
| **Clear Event**            | Clears the selection (`⌘⇧E`).                                                                    |

## Submenus under Event Analysis / Session Analysis

Click **Event Analysis** or **Session Analysis** to expose a submenu. IDs map
to:

- **Event Results** / **Session Results**
- **Qualification Results** (event-wide only)
- **Fastest Laps**
- **Fastest Average Laps**
- **Driver Analysis**
- **Bump-Up**, **Driver Progression** (event-wide only — hidden when viewing
  Session Analysis)

Session Analysis resets to compatible subtabs automatically if you were viewing
a ladder-only subtab.

## Overview surface (mixed summary + class insights)

Expect:

- Track map & address block with outbound links (maps, LiveRC venue, mail).
- KPI cards (**Races**, **Drivers**, optional **Entries**, **Laps**, **Classes**
  depending on ingestion).
- **Event mix**, **driver mix**, **lap mix** sparkline-style summaries with
  dialogs for deeper percentages.
- **Event Conditions** widgets (forecast text, extremes, hourly sparkline).
- Overall class podium previews; each class row opens richer standings modals
  where available.
- Toggle between aggregated **Event Results** and granular **Session Results**
  within the Overview band.

Selecting drivers/classes in toolbars cascades charts/tables downstream where
the variant supports filtering.

## Entry List tab

Previously documented as generically “Drivers”; the shipped label is **Entry
List**. Expect sortable grids, normalization indicators, class filters, and
cross-links into session charts when selecting drivers from shared pickers
maintained by the Actions context provider.

## Practice-day programmes

Practice days swap the pill strip for:

- **My Day**
- **My Sessions**
- **Class Reference**
- **All Sessions**

The **Actions** strip still exposes import/refresh/host-track/clear tooling, but
fuzzy **My Events** rail affordances stay hidden until you return to a
qualifying/race programme.

Telemetry-centric import flows are documented separately under
`/eventAnalysis/my-telemetry`.

## Collaboration & class winners

Race programmes may surface LiveRC-aligned **overall final ranking**,
**multi-main** ladders, bump-up ladders, **top qualifiers** callouts (TQ badges
in hero cards), and class winner modals. Exact cards depend on what LiveRC
exposes for each ingest.

## Data refresh & ingestion caveats

- Use **Refresh Event Data** if charts look stale relative to upstream LiveRC
  edits.
- If ingestion failed, fix pipeline health (Ops) rather than reloading the SPA
  repeatedly.
- Weather panels distinguish cached snapshots vs fresh API pulls; transient HTTP
  errors still allow lap analysis elsewhere on the page.

## Export expectations (alpha scope)

Dedicated “Export all tables to CSV” buttons are **not** a headline feature
across every Event Overview surface in Alpha v0.1.0. Where exports exist (for
example telemetry importers elsewhere in the authenticated shell), they are
documented beside those modules.

If spreadsheet exports become first-class inside Event Overview/Analysis tabs,
regenerate this section from the shipped React components listing export
handlers.

## Related guides

- [My Event Analysis (dashboard shell)](dashboard.md)
- [Global Search](event-search.md)
- [Navigation & shortcuts](navigation.md)
- [Driver Features & My Events rail](driver-features.md)
- [Troubleshooting](troubleshooting.md)
