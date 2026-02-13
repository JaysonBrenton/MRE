---
created: 2026-01-27
creator: Jayson Brenton
lastModified: 2026-02-01
description: Guide to using the user dashboard in My Race Engineer
purpose:
  Explains how to navigate the My Event Analysis dashboard, select events,
  launch searches, and read the Event Analysis experience that appears on the
  page once an event is selected.
relatedFiles:
  - docs/architecture/dashboard-architecture.md
  - docs/specs/mre-v0.1-feature-scope.md
---

# My Event Analysis Guide

The My Event Analysis dashboard is the entry point for reviewing imported race
events. Rather than free-form widgets, the current build centers on choosing an
event and then displaying the Event Analysis experience directly within the
dashboards area.

## Introduction

When you sign in and navigate past the welcome screen, the dashboard shows a
protected “Select an Event” surface. Once you choose an event, the familiar
Event Analysis tabs (Overview, Drivers, Sessions, My Events) render in place so
you can review lap charts, driver cards, and weather from the same view.

## Prerequisites

- You must be logged in.
- At least one event must exist in the system. You can ingest or discover events
  through **Event Search** if nothing appears yet.

## Accessing My Event Analysis

1. Sign into My Race Engineer.
2. From the navigation rail, click **My Event Analysis** (the home icon).
3. Use the breadcrumb labeled “My Event Analysis” to return here from other
   authenticated pages.

## Page Layout

The dashboard contains three main elements:

### 1. Event Selector & Empty State

- The top of the page renders the **Dashboard Event Selector**. If an event ID
  is present in the URL (`/dashboard?eventId=uuid`) the selector loads that
  event automatically. Otherwise, the page shows a card prompting you to search
  for events.
- The selector includes quick filters for “Recent Events” once data is loaded,
  making it easy to jump back to something you viewed earlier.

### 2. Dashboard Event Search Drawer

- Clicking **Search for Events** or the event selector’s search action opens the
  embedded Event Search drawer. This is the same search experience available on
  the dedicated `/event-search` page.
- You can search by track, date range, or mode (standard events vs. practice
  days). When you choose **Practice Days**, the form exposes the month picker
  from `PracticeDaySearchContainer` so you can discover LiveRC practice entries.
- Selecting an event from the search results automatically sets it as the active
  dashboard event and closes the drawer.

### 3. Event Analysis Section

- Once an event is selected, the **EventAnalysisSection** component mounts in
  place of the empty state. It fetches `/api/v1/events/{eventId}/summary`,
  `/analysis`, and `/weather` to power charts and telemetry-derived insights.
- Tabs correspond to the same content you see on the standalone Event Analysis
  route:
  - **Overview** – hero metrics, pace charts, weather, track summary.
  - **Drivers** – driver cards with consistency, lap counts, best laps.
  - **Sessions** – session list and lap charts, including the My Events sub-tab.
  - **My Events** – fuzzy-matched races linked to your driver persona, including
    confirm/reject controls.
- The weather panel shows cached vs. live fetch status and explains failures,
  exactly matching the `/api/v1/events/[eventId]/weather` endpoint behavior.

## Selecting an Event

1. Click **Search for Events** (or open the selector dropdown).
2. Filter by track, date, or practice-day mode as needed.
3. Choose **Import** for new LiveRC data or select an already ingested event.
4. The dashboard URL updates with `?eventId=...`, and Event Analysis loads in
   place.

If you navigate away and return later, the persisted Redux state restores the
last selected event. On a hard reload, the page briefly shows “Loading
dashboard…” while Redux rehydrates; this prevents flicker before the event data
is re-fetched.

## Reading the Event Analysis Tabs

Because the dashboard embeds the same Event Analysis implementation, you can use
all familiar interactions:

- Hover or tap chart legends to isolate drivers.
- Use the **Sessions** tab to switch between mains, qualifiers, and practice
  runs.
- In **My Events**, confirm or reject fuzzy matches; the UI calls
  `/api/v1/users/me/driver-links/events/{eventId}` so you never have to look up
  your user ID.
- Open driver rows to see transponder overrides, lap consistency, and class
  participation.

## Troubleshooting

| Symptom                                 | Resolution                                                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Dashboard only shows “Select an Event”  | No event has been chosen yet. Use the search drawer or append `?eventId=` with a valid event ID.                                     |
| Weather pane shows a warning            | The weather endpoint could not fetch live data and no cache exists. Try again later; the rest of Event Analysis is still usable.     |
| Practice Days mode missing              | Ensure the event search drawer toggle is set to “Practice Days.” The dashboard uses the same mode selector as the Event Search page. |
| Driver matches missing in My Events tab | Confirm your driver persona is configured, and verify driver links via `/api/v1/users/me/driver-links`.                              |

## Key Takeaways

- The current dashboard is an event-centric workflow: select ➝ analyze.
- Widget layout customization is not part of version 0.1.1 even though future
  releases plan drag-and-drop dashboards.
- For additional analytics, switch to the dedicated **Events**, **Event
  Search**, or **Admin** pages via the navigation rail or breadcrumbs.
