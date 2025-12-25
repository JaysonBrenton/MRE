---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: Overview and goals for the LiveRC ingestion subsystem
purpose: Provides the conceptual foundation for the LiveRC ingestion subsystem, defining
         the high-level user workflow, architectural goals, constraints, and long-term
         vision. This document serves as the entry point for understanding the ingestion
         pipeline architecture.
relatedFiles:
  - docs/specs/mre-v0.1-feature-scope.md
  - docs/architecture/mobile-safe-architecture-guidelines.md
---

# LiveRC Ingestion – Overview & Goals

**Status:** This ingestion subsystem is **in scope for the Alpha release**. See [MRE Alpha Feature Scope](../../specs/mre-v0.1-feature-scope.md) for Alpha feature specifications.

**Related Documentation:**
- [Mobile-Safe Architecture Guidelines](../mobile-safe-architecture-guidelines.md) - Overall MRE architecture principles
- [MRE Alpha Feature Scope](../../specs/mre-v0.1-feature-scope.md) - Alpha release feature specifications

## Purpose

The LiveRC ingestion subsystem provides My Race Engineer (MRE) with the ability to
retrieve, normalise and store race event data from LiveRC. This includes:

- A complete catalogue of all LiveRC tracks.
- On-demand discovery of events for a selected track.
- Deep ingestion of full event details (races, drivers, results, laps).
- Long-term storage of data for user analysis and visualisation.

This subsystem is architected to support additional data sources in the future
(e.g., LiveTime JSON exports, MyLaps, SodiDialed, telemetry devices). LiveRC is
the first connector.

---

## High-Level User Workflow

The ingestion system exists to support a very specific user flow:

1. A user logs into MRE.
2. The user selects a track from the track catalogue.
3. The user chooses a “Held-Between” date range.
4. MRE returns a list of all events for that track whose event_date falls
   between the selected dates.
5. The user selects one event from the list.
6. MRE ingests the full event data from LiveRC **on demand** (only when required).
   - Event ingestion always includes complete data: races, results, and lap data (`laps_full` depth).
   - Event discovery (`none` depth) is metadata-only for browsing/searching.
7. Once ingestion completes, the user can visualise race results and lap data
   in novel, meaningful ways.

Important: **Events are never scraped automatically.** Only Tracks are proactively
synced. Events and their detailed data are retrieved on demand.

---

## Architectural Goals

### 1. Separation of Concerns
MRE will implement ingestion using clear and layered boundaries:

- **Connector layer** — fetches and parses raw data from LiveRC.
- **Ingestion service layer** — coordinates connector calls, handles DB writes,
  ensures idempotency, and defines ingestion depth.
- **Domain/storage layer** — stores Tracks, Events, Races, RaceResults, Laps.
- **User interface layer** — queries only MRE’s internal database.
- **Admin & CLI layer** — controls ingestion workflows.

The connector must remain **stateless**, **deterministic**, and **fully isolated**
from business logic or persistence.

---

## Constraints and Considerations

### Anti-Bot Friendliness
The system must avoid aggressive scraping. Therefore:

- Only the **Track catalogue** is fetched proactively.
- Events are discovered only when an admin requests it.
- **Full event ingestion (laps, results) occurs only when a user selects an event.**

This minimises requests to LiveRC and mirrors natural user behaviour.

### On-Demand Ingestion
MRE never downloads event data unless a user explicitly expresses interest in an
event. This ensures scalability and avoids storing large volumes of unused data.

### Multi-Connector Support
The architecture must support additional connectors without altering ingestion
logic. This is achieved by enforcing a consistent connector interface.

### Local Execution
Ingestion runs **locally on the MRE machine**, with clean boundaries so that
future distributed or cloud execution is still possible.

---

## Long-Term Vision

The ingestion system provides the foundation for:

### Advanced Visualisation
- Lap time graphs
- Position-over-time graphs
- Driver comparison overlays
- Consistency and drop-off analytics

### Intelligent Coaching (LLM Integration)
The system will eventually feed an analytics layer used by an LLM to answer
queries such as:

- “Why did my lap times fall off after lap 20?”
- “How did I compare to the leader in the first 5 minutes?”
- “Am I more consistent on this track compared to last year?”

Raw laps are stored in a normalised structure, and summary tables will be added
later to support fast analysis.

---

## Summary

The LiveRC ingestion subsystem is not a simple scraper. It is a structured,
multi-layered data ingestion pipeline designed to:

- Maintain the global LiveRC track catalogue.
- Allow users to discover events via date filtering.
- Ingest event data on demand, only when needed.
- Provide clean and reliable data for visualisation and analysis.
- Support future connectors and LLM-driven insights.

This document serves as the conceptual foundation for all subsequent technical
design documents.
