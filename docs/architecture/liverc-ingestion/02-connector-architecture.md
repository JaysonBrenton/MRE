---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: Complete connector specification including architecture, contracts, browser strategy, HTTP client, and HTML/JS parsing
purpose: Defines the complete connector layer architecture that provides a uniform interface for
         retrieving external race data from LiveRC and future data sources. This document
         consolidates connector architecture, contracts, browser strategy, HTTPX client architecture,
         and HTML parsing architecture into a single comprehensive specification.
relatedFiles:
  - docs/architecture/liverc-ingestion/01-overview.md
  - docs/architecture/liverc-ingestion/03-ingestion-pipeline.md
  - docs/specs/mre-v0.1-feature-scope.md
  - docs/architecture/mobile-safe-architecture-guidelines.md
---

# Connector Architecture Specification

**Status:** This ingestion subsystem is **in scope for version 0.1.1 release**. See [MRE Version 0.1.1 Feature Scope](../../specs/mre-v0.1-feature-scope.md) for version 0.1.1 feature specifications.

**Related Documentation:**
- [LiveRC Ingestion Overview](01-overview.md) - System overview
- [Mobile-Safe Architecture Guidelines](../mobile-safe-architecture-guidelines.md) - Overall MRE architecture principles

## Purpose

The Connector layer provides a clean, uniform interface for retrieving external
race data from any supported provider. LiveRC is the first connector, but the
design must support additional sources such as:

- LiveTime local JSON exports
- MyLaps / AMB timing systems
- SodiDialed setup data
- Native telemetry devices

Connectors must be **stateless**, **pure**, and **data-only**: they retrieve and
parse external data but do not write to the database or contain any ingestion
logic.

---

## Architectural Principles

### 1. Pure Functions Only
A connector may **only**:

- Fetch data from the external source.
- Parse the HTML, JS structures, JSON, or files.
- Return strongly typed domain-like objects.

A connector may **not**:

- Perform database writes.
- Perform ingestion logic or deduplication.
- Handle retention strategies.
- Know anything about MRE's user workflows.

### 2. No Side Effects
Connectors must be deterministic and repeatable. If the same external URL is
fetched twice, the connector must return the same structured result.

### 3. Minimal External Load
The connector must respect anti-bot constraints:

- No unnecessary requests.
- No repeated scraping of the same event in short succession.
- Avoid JavaScript browser automation except as a last resort.

### 4. Shared Site Policy Enforcement

All outbound HTTP/Playwright calls flow through `policies/site_policy/policy.json` via:

- `ingestion/common/site_policy.py` (Python runtime)
- `src/lib/site-policy.ts` (Next.js runtime)

This policy enforces:

- Global kill switch (`MRE_SCRAPE_ENABLED`) honored by cron, CLI, the ingestion API, and the Next.js admin UI.
- robots.txt allow/disallow checks + crawl-delay parsing.
- Host-level throttling (semaphores + crawl-delay) with jitter.
- Conditional requests (ETag/Last-Modified caching) and `Retry-After` handling inside the HTTPX client.

Connectors **must not** bypass the site policy helper. If a new data source is added, update `policy.json` and both helper modules to describe its host rules.

**See [Web Scraping Best Practices](27-web-scraping-best-practices.md) for comprehensive documentation of all web scraping practices, including robots.txt compliance, rate limiting, User-Agent policy, HTTP caching, and more.**

### 5. One Connector Per Data Source
Each external system receives its own module:

connectors/
liverc/
LiveRCConnector.ts
livetime/
LiveTimeConnector.ts
sodialed/
SodiDialedConnector.ts
...

yaml
Copy code

Each must implement the same interface.

---

## Connector Interface

All connectors must implement the following high-level operations:

### `listTracks(): Promise<TrackSummary[]>`
Returns a minimal list of tracks (or equivalents) available from the data
source. For LiveRC, this corresponds to the Track Catalogue at
`https://live.liverc.com`.

### `listEventsForTrack(track: TrackSummary): Promise<EventSummary[]>`
Given a track, return all high-level event metadata:

- event name  
- event date  
- entries  
- drivers  
- source_event_id  
- event URL  

This returns **summary only** — no races or laps.

### `fetchEventDetails(event: EventSummary): Promise<EventDetails>`
Fetches the high-level event metadata from the event detail page.  
For LiveRC, this includes:

- Event title  
- Date  
- Classes present  
- Possibly event description  

### `fetchEventRaces(event: EventSummary): Promise<RaceSummary[]>`
Discovers the list of races (heats, qualifiers, mains).  
Each RaceSummary should include:

- class_name  
- race_label  
- source_race_id (if present)  
- race URL  

### `fetchRaceResults(race: RaceSummary): Promise<RaceResultRaw[]>`
Returns all driver results for a race:

- driver name  
- driver numbering (if available)  
- finishing position  
- laps completed  
- total time  
- averages, consistency, best lap  
- raw JS blocks if needed for later parsing  

### `fetchRaceLaps(race: RaceSummary): Promise<RaceLapRaw[]>`
Returns the raw lap data for each driver in the race.  
For LiveRC, this parses the `racerLaps[...]` JS object.

### `fetchTrackDashboard(track_slug: string): Promise<string>`
Fetches the track dashboard page HTML. For LiveRC, this fetches `https://{slug}.liverc.com/`. Returns raw HTML string. Used internally by `fetchTrackMetadata()`.

### `fetchTrackMetadata(track_slug: string): Promise<TrackDashboardData | null>`
Fetches and parses track dashboard page to extract comprehensive metadata including:
- Location data: coordinates, address, city, state, country, postal code
- Contact information: phone, website, email
- Track description and amenities
- Logo and social media URLs
- Lifetime statistics: total laps, races, events

Returns `null` if fetch/parse fails (graceful degradation). This method is used during track sync to enrich track records with additional metadata beyond the basic catalogue information.

---

## Data Shapes Returned by Connectors

Connectors must return **plain data objects**, not ORM models. These objects form
the canonical “external data contract” that the ingestion layer will validate
and persist.

All returned objects should follow this pattern:

### Example: `TrackSummary`
```ts
{
  source: "liverc",
  source_track_slug: "canberraoffroad",
  track_name: "Canberra Off Road Model Car Club",
  track_url: "https://canberraoffroad.liverc.com/",
  events_url: "https://canberraoffroad.liverc.com/events",
  liverc_track_last_updated: "2024-11-21T00:00:00Z"
}
Example: EventSummary
ts
Copy code
{
  source: "liverc",
  source_event_id: "6304829",
  track_slug: "canberraoffroad",
  event_name: "Rudi Wensing Memorial 2024",
  event_date: "2024-01-14",
  event_entries: 114,
  event_drivers: 87,
  event_url: "https://canberraoffroad.liverc.com/events/?p=view_event&id=6304829"
}
Responsibilities the Connector Must Respect
Responsibilities Connectors SHOULD Have
Construct external URLs.

Fetch remote HTML/JSON/JS.

Parse stable DOM structures.

Extract embedded JS objects (e.g., racerLaps[...]).

Normalise field shapes into typed summary objects.

Responsibilities Connectors MUST NOT Have
Database access.

Data deduplication.

Ingestion scheduling.

Retention logic.

User-driven filtering.

Internal domain modelling.

All ingestion and business logic belongs to the Ingestion Service.

Versioning and Stability
Connectors must define:

Which LiveRC HTML structures they depend on.

Which fields are considered stable vs brittle.

How to safely evolve parsing when LiveRC UI changes.

A section in the LiveRC data model document (04-data-model.md)
will define these patterns in detail.

Error Handling
Connectors must:

Surface scraping/parse errors clearly.

Never swallow or transform errors silently.

Return partial-but-well-defined results where safe.

Provide clear exceptions for:

network failures,

missing required elements,

unexpected page formats.

The ingestion service will decide how to respond or retry.

Summary
The connector architecture ensures:

Clean separation of concerns.

Reproducible, testable parsing logic.

Support for multiple external data sources.

Anti-bot friendly behaviour.

Predictable boundaries for Cursor and LLM assistants.

This document defines the blueprint for all connectors, starting with LiveRC.

---

## Sources Merged From

This document consolidates content from the following files (now deprecated):
- `09-connector-contracts.md` - Interface contracts and domain output models
- `10-connector-browser-strategy.md` - Browser usage strategy and decision tree
- `25-httpx-client-architecture.md` - HTTPX client architecture and operational rules
- `26-html-parsing-architecture.md` - HTML and script parsing architecture

---

## Connector Contracts

### Purpose of the Connector Layer

The connector:
- Fetches pages from LiveRC using HTTPX or Playwright (only when required)
- Parses event pages into structured objects
- Parses race result pages into structured objects
- Extracts driver lap series
- Detects unexpected page conditions (e.g., missing tables, malformed rows)
- Raises structured errors when LiveRC content cannot be interpreted

The connector MUST NOT know anything about the MRE database schema.

### Connector Guiding Principles

1. **Deterministic output**  
   Same HTML → same structured object.

2. **Strict type guarantees**  
   All fields MUST be present and valid. Missing fields MUST raise an error.

3. **Zero business logic**  
   No ingestion state checks. No DB writes. No timestamps.

4. **Idempotency at the data level**  
   A second parse of the same page MUST produce the same object.

5. **Browser automation minimized**  
   Playwright SHOULD only be used when absolutely necessary, typically for:
   - event pages that require expanding sections
   - race pages with dynamic content

6. **Connector errors must be domain-specific**  
   The ingestion layer should receive errors such as:
   - EventPageFormatError
   - RacePageFormatError
   - LapTableMissingError
   - ConnectorHTTPError

Never generic exceptions.

### Core Domain Output Models

The connector MUST output the following domain objects:

#### ConnectorEventSummary
Represents the high-level parsed data from an event page.

Fields:
- source_event_id (string)
- event_name (string)
- event_date (ISO timestamp)
- event_entries (integer)
- event_drivers (integer)
- races (list of ConnectorRaceSummary)

#### ConnectorRaceSummary
Represents metadata describing a single race within an event.

Fields:
- source_race_id (string)
- class_name (string)
- race_label (string) (e.g. "A-Main", "Heat 2", "Qualifier 1")
- race_order (integer)
- race_url (string)
- start_time (ISO timestamp) or null
- duration_seconds (integer or null)

#### ConnectorRaceResult
Represents a driver's results in a race.

Fields:
- source_driver_id (string)
- display_name (string)
- position_final (integer)
- laps_completed (integer)
- total_time_seconds (float)
- fast_lap_time (float or null)
- avg_lap_time (float or null)
- consistency (float or null)

#### ConnectorLap
Represents a single lap.

Fields:
- lap_number (integer)
- position_on_lap (integer)
- lap_time_seconds (float)
- lap_time_raw (string)
- pace_string (string or null)
- elapsed_race_time (float)
- segments (list of segment strings or empty list)

#### ConnectorRacePackage
Represents a full race ingestion unit returned from parsing a race page.

Fields:
- race_summary (ConnectorRaceSummary)
- results (list of ConnectorRaceResult)
- laps_by_driver (dict keyed by source_driver_id → list of ConnectorLap)

#### TrackDashboardData
Represents extracted metadata from a track dashboard page.

All fields are optional (nullable) to support graceful degradation when parsing fails.

Fields:
- latitude (float | None) - Track latitude coordinate
- longitude (float | None) - Track longitude coordinate
- address (str | None) - Full address string
- city (str | None) - City name
- state (str | None) - State/province name
- country (str | None) - Country name
- postal_code (str | None) - Postal/ZIP code
- phone (str | None) - Phone number
- website (str | None) - Website URL
- email (str | None) - Email address
- description (str | None) - Track description/amenities
- logo_url (str | None) - Track logo image URL
- facebook_url (str | None) - Facebook page URL
- total_laps (int | None) - Total lifetime laps
- total_races (int | None) - Total lifetime races
- total_events (int | None) - Total lifetime events

### Required Connector Functions

The connector MUST export the following functions. These are contracts the ingestion pipeline depends on.

#### fetch_event_page(track_slug, source_event_id)
Returns: ConnectorEventSummary

Responsibilities:
- Build the correct event URL
- Fetch page (HTTP or Playwright)
- Extract top-level event metadata
- Extract list of races
- Validate all race summaries
- Raise EventPageFormatError on malformed content

#### fetch_race_page(race_summary)
Returns: ConnectorRacePackage

Responsibilities:
- Fetch race result page
- Extract result table
- Extract lap tables for each driver
- Produce a ConnectorRacePackage
- Raise RacePageFormatError on malformed content

This function MUST fully resolve lap data for all drivers in the race.

#### fetch_lap_series(race_summary, source_driver_id)
Returns: List[ConnectorLap]

This is an optional helper depending on implementation.

Responsibilities:
- Extract lap table for a single driver
- Raise LapTableMissingError if data cannot be found

In V1, this SHOULD NOT be called by the ingestion layer directly. The pipeline will rely on fetch_race_page, which handles all drivers.

#### fetch_track_dashboard(track_slug)
Returns: str (HTML content)

Fetches the track dashboard page HTML from `https://{slug}.liverc.com/`. Used internally by `fetch_track_metadata()`.

**Responsibilities:**
- Build track dashboard URL
- Fetch page using HTTPX (or Playwright if needed)
- Return raw HTML content
- Handle HTTP errors gracefully

#### fetch_track_metadata(track_slug)
Returns: TrackDashboardData | None

Fetches and parses track dashboard page to extract comprehensive metadata including location data (coordinates, address), contact information (phone, website, email), track description, logos, and lifetime statistics. Returns `None` if fetch/parse fails (graceful degradation). Used during track sync to enrich track records.

**Responsibilities:**
- Fetch dashboard HTML via `fetch_track_dashboard()`
- Parse HTML to extract metadata fields
- Handle parsing errors gracefully (log, return None)
- Return structured metadata object

**Extracted Metadata:**
- Location: latitude, longitude, address, city, state, country, postal_code
- Contact: phone, website, email
- Descriptive: description, logo_url, facebook_url
- Statistics: total_laps, total_races, total_events

### Error Contracts

Connector errors MUST be MRE-specific and MUST NOT expose low-level details.

Required error types:
- ConnectorHTTPError
- EventPageFormatError
- RacePageFormatError
- LapTableMissingError
- UnsupportedLiveRCVariantError

Rules:
- Errors MUST include both a human-readable message and a machine-readable code.
- Errors MUST NOT contain HTML snippets or raw responses.
- Errors MUST be logged by the ingestion pipeline, not the connector itself.

### URL Construction Rules

The connector MUST consistently derive URLs based on:
- Track slug (e.g. "canberraoffroad" → https://canberraoffroad.liverc.com)
- Event page: /results/?p=view_event&id={source_event_id}
- Race page: /results/?p=view_race_result&id={source_race_id}

URL rules MUST be centralised in a utility module to prevent duplication.

### Connector Determinism Guarantees

The connector MUST ensure:
1. Race ordering matches the source page
2. Drivers appear in the same order as LiveRC shows
3. Laps appear in correct lap_number order
4. All timestamps parsed deterministically
5. Parsing is insensitive to whitespace, HTML formatting quirks, or irrelevant markup

If LiveRC changes its structure:
- The connector MUST fail loudly with UnsupportedLiveRCVariantError.

---

## Browser Strategy

### Goals of the Browser Strategy

The browser strategy MUST satisfy the following:
1. Use HTTPX for speed and simplicity whenever possible.
2. Use Playwright only when technically necessary.
3. Minimise Playwright usage to reduce:
   - anti-bot likelihood
   - operational overhead
   - latency
4. Ensure deterministic extraction of:
   - event metadata
   - race metadata
   - race results
   - lap time series
5. Allow ingestion to remain stable even if the UI changes slightly.

The connector MUST hide all browser decisions behind simple function calls such as `fetch_event_page` and `fetch_race_page`.

### Overview of LiveRC Content Types

The connector must treat LiveRC pages as belonging to one of the following:

#### Static Pages (easy to scrape)
Examples:
- `https://TRACK.liverc.com/events`
- `https://TRACK.liverc.com/results/?p=view_event&id=XXXXX`
- Most race result pages

These pages:
- Return predictable HTML
- Do not require JavaScript rendering
- Are fully retrievable with HTTPX

#### Dynamic Pages (require browser)
Examples:
- Pages where the "View Laps" table loads only after a user action
- Pages where HTML sections expand via JavaScript
- Pages that detect bots based on HTTP patterns and require a JS environment

These require Playwright.

#### Hybrid Pages
Some pages are static for metadata but dynamic for lap detail.

The browser strategy MUST handle this distinction automatically.

### Strict Rule: Playwright Only for One Type of Page

The overall design goal is:

**"Use Playwright for exactly one page per race."**

Specifically:
- The *race result page* (with lap tables) is the page most likely to require JavaScript-driven content.
- All other pages are handled by HTTPX unless proven otherwise.

This rule drastically simplifies the connector design.

### Decision Tree: HTTPX or Playwright?

The connector MUST follow this decision tree internally for each page:

#### Step 1 — Try HTTPX
If the HTML already contains:
- race result tables
- lap data containers
- event metadata fields
- race list entries

…then use the HTTPX response.

#### Step 2 — Check for dynamic dependencies
If the elements are missing or collapsed behind anchors such as:
- `View Laps`
- `.panel-collapse`
- JavaScript-driven tab sections

…then Playwright MUST be used.

#### Step 3 — Detect anti-bot protections
LiveRC may:
- delay JS execution
- hide certain tables until JS evaluates
- throttle "too fast" fetches

When HTTPX-based parsing fails consistently for a given page type, the connector MUST escalate that page type to ALWAYS use Playwright.

#### Step 4 — Cache page classification
If a page type consistently requires Playwright, the connector MAY maintain a lookup table so ingestion becomes deterministic and faster.

This table MUST live inside the connector module, not the ingestion system.

### Playwright Operational Rules

When Playwright is used, the connector MUST:

1. Launch a **headless Chromium instance** with:
   - realistic User-Agent
   - moderate simulated typing/mouse delays disabled (not needed)
   - standard viewport size
   - JS enabled

2. Wait for specific selectors before extraction:
   - result tables (e.g. `table.table-striped`)
   - lap tables within driver sections
   - `div.panel-body` for "View Laps"

3. Extract final DOM state, never raw content.

4. Immediately close the browser context after scraping one page.

5. Not throttle itself; the ingestion orchestrator handles rate limiting.

#### Forbidden Playwright Usage
The connector MUST NOT:
- keep long-running browser instances alive between events
- navigate multiple pages within the same context
- click UI elements other than "expand laps"
- store screenshots or logs beyond debug mode

### HTTPX Operational Rules

When using HTTPX, the connector MUST:
- Set standard headers (User-Agent, Accept, etc.)
- Follow redirects
- Respect timeouts and retry policies
- Never present itself as a bot (avoid suspicious headers)
- Handle gzip/deflate transfer encoding

HTTPX is preferred for:
- track catalogue ingestion
- event catalogue ingestion
- event metadata extraction
- basic race result extraction

### Anti-Bot Safety Strategy

The connector MUST adhere to these safety rules:

1. **Low-frequency ingestion**  
   Ingestion runs happen only when an admin triggers them.

2. **Natural-looking request patterns**  
   The connector MUST NOT flood LiveRC with parallel requests.

3. **Use browser only when necessary**  
   Playwright mimics a real browser, reducing anti-bot risk.

4. **Retry with backoff**  
   HTTPX and Playwright fetch failures MUST use exponential backoff before raising errors.

5. **Avoid suspicious automation signals**  
   No automation headers. No odd request patterns. No manipulating cookies.

This strategy is not about *evading protections*, but ensuring *cooperative polite scraping*.

**For comprehensive web scraping best practices, including detailed implementation of robots.txt compliance, rate limiting, User-Agent policy, HTTP caching, retry logic, and kill switch mechanism, see [Web Scraping Best Practices](27-web-scraping-best-practices.md).**

### Page-Type-to-Tool Matrix

| Page Type                         | HTTPX | Playwright | Notes |
|----------------------------------|-------|------------|-------|
| Track list (live.liverc.com)     | Yes   | No         | Static content |
| Event list (/events)             | Yes   | No         | Simple table |
| Event detail                     | Yes   | Maybe      | If races hidden behind JS |
| Race summary                     | Yes   | No         | Often complete HTML |
| Race results with lap tables     | Maybe | Yes        | This is the one page that typically needs JS |
| Individual lap sections          | No    | Yes        | Anchor expansion via JS |

The connector MUST optimise for the above behaviours.

### Failure Recovery Rules

If a Playwright scrape fails:
- Retry with a new browser context
- Then retry with exponential backoff
- If still failing, raise a *connector-specific* error (never raw Playwright)

The ingestion pipeline will:
- abort the event ingestion
- leave DB unchanged
- propagate a clean error to the CLI or API caller

---

## HTTPX Client Architecture

### Design Goals

The HTTPX client must be:
- Deterministic
- Anti-bot friendly (no spoofing, no stealth fingerprinting, no rotation)
- Predictable under load
- Resilient to temporary upstream issues
- Observable and debuggable
- Safe to use from ingestion workers, CLI, and dev tooling
- Easy to replace or extend with a browser fallback (Playwright)

The client must provide a stable, uniform interface to all connectors.

### Global Rules

#### One shared HTTPX client per ingestion session

A single shared `AsyncClient` instance must be created per ingestion run.  
Never create clients ad-hoc inside individual scraping functions.

This guarantees:
- consistent headers
- consistent cookies
- consistent connection pooling
- predictable upstream fingerprint
- lower resource usage
- easier debugging

#### Timeouts

All outbound HTTP requests must use the following timeouts:
- connect: 5 seconds
- read: 20 seconds
- write: 5 seconds
- pool: 5 seconds
- total request hard cap: 30 seconds

Timeouts must be enforced strictly to prevent worker starvation.

#### Retries

All requests must use a three-level retry policy:
- retry count: 3
- strategy: exponential backoff
- base delay: 0.5 seconds
- jitter: enabled
- retryable failures:
  - connection errors
  - timeouts
  - 5xx upstream errors
  - 429 rate limits (respect Retry-After header)

The client must never retry 4xx errors except 429.

#### User-Agent

MRE must present a fixed, honest user-agent:

`MRE-IngestionBot/1.0 (contact: admin@domain.com)`

This avoids hostile anti-bot detection behaviours and maintains trust.

---

## HTML Parsing Architecture

### Purpose and Design Goals

The HTML parsing layer must provide:
- Deterministic extraction of structured data from LiveRC pages
- Stable long-term behaviour despite changes to LiveRC front-end markup
- Strict validation and normalisation of all extracted values
- Fail-fast behavior for malformed or incomplete upstream pages
- Full integration with fixtures, replay, and debugging tools
- Safe, observable, testable behaviour without reliance on browser execution

Parsing must support two categories of input:
1. Traditional HTML markup (race lists, tables, headings, breadcrumbs)
2. Embedded JavaScript data structures (e.g., racerLaps blobs)

The parser must operate as part of the ingestion pipeline's extract → transform → validate → store sequence.

### Parsing Stack Selection

#### Primary HTML Parser: selectolax (required)

MRE must use the selectolax HTML parser.

Reasons:
- Extremely fast (10–50x faster than BeautifulSoup)
- Lenient with malformed markup (critical for LiveRC)
- Provides efficient CSS selectors
- Compatible with streaming or preloaded HTML
- Low memory overhead
- Works perfectly in async ingestion workflows

#### Script and JSON Parsing: Python stdlib only

The parser must use:
- re (for targeted extraction of JS variables)
- json (for real JSON)
- ast.literal_eval (only when upstream JS uses Python-compatible literals)

Under no circumstances may the parser:
- Evaluate raw JavaScript
- Execute JS inside Python
- Use third-party JS interpreters

#### Prohibited Technologies

- BeautifulSoup4 (too slow for ingestion scale)
- Selenium (browser execution is handled by Playwright fallback)
- html5lib (too slow)
- regex-only scraping of entire pages (allowed only for micro-extractions)

### Parser Architecture

Parsing is partitioned into a stable set of domain-specific parsers. Each parser is pure, synchronous, and side-effect free.

DomainParser implementations:
- TrackListParser
- EventListParser
- EventMetadataParser
- RaceListParser
- RaceMetadataParser
- RaceResultsParser
- RaceLapDataParser (parses racerLaps embedded JS)

All parsers must follow the same interface:

`parse(html: str, url: str) → ParsedX`

Where ParsedX is a dataclass or typed structure.

#### No parser may perform network requests

All network access is encapsulated in the HTTPX layer.

#### No parser may depend on database state

Parsers operate on raw HTML only.

#### Parsers must be idempotent

Given identical HTML, they must always produce identical outputs.

### Extraction Rules

#### CSS Selector Standards

Parsers must use selectolax CSS selectors in the following style:
- Specific, stable selectors (avoid nth-child selectors)
- Prefer attributes and class names
- Fall back to structural context when needed

If multiple markup variants exist:
- Parsers must accept all known variants
- Parsers must fail with a clear error if no variant matched

#### Embedded JS Extraction

LiveRC stores rich data in JS variables, such as:

`var racerLaps = {...};`

Rules:
- Locate script tags containing known identifiers (e.g., "racerLaps")
- Extract exactly the relevant variable assignment using anchored regex
- Clean the JS block (strip trailing semicolons, convert single quotes)
- Transform into JSON or Python-safe structures
- Validate structure against expected schema

Parsers must never:
- Execute JavaScript
- Evaluate arbitrary code
- Accept unbounded script contents

### Normalisation Rules

All parsing must normalise upstream values before returning them.

#### String Normalisation

Rules:
- Strip whitespace
- Collapse multiple spaces into one
- Normalise Unicode
- Replace non-breaking spaces
- Remove trailing punctuation where required

#### Number Normalisation

Rules:
- Convert lap times like "38.17" into float seconds
- Convert total-time strings like "30:32.160" into integer seconds
- Convert driver ranks into integers
- Convert lap numbers into integers
- Convert pace strings into structured fields

#### Date Normalisation

Rules:
- Determine event local timezone (LiveRC sometimes embeds this)
- Convert to UTC
- Store as ISO 8601 strings
- Validate parsed timestamps with strict mode

#### Race Label Normalisation

Examples:
- "A-Main"
- "Heat 3"
- "Round 2 – Heat 5"

Rules:
- Extract components: round, heat, class, main
- Generate canonical machine forms for ordering
- Preserve original for display

### Validation Requirements

All parser outputs must be validated according to:
- [Ingestion Validation Rules](08-ingestion-operations.md#validation-rules)
- [Ingestion Error Handling](08-ingestion-operations.md#error-handling)

Validation failures include:
- Missing required keys
- Empty tables
- Missing racerLaps blob
- Mismatched field counts
- Zero-length races
- Invalid numbers
- Malformed pace strings
- Impossible timestamps

Validation failures must:
- Stop ingestion immediately
- Produce a deterministic error report
- Store the failing HTML in a debug directory

### Integration With Ingestion Pipeline

After parsing, the output passes to:
1. Transform layer
2. Validation layer
3. Database ingestion layer
4. State machine updates

Parsers do not store or log anything directly.

#### Fixture Integration

When ingestion operates in replay mode:
- Parsers must operate on saved HTML exactly as they would live HTML
- No code path differences

#### Browser Fallback Integration

If HTML is incomplete or critical JS is missing:
- The ingestion engine may escalate to Playwright fallback
- The parser must accept HTML from either HTTPX or Playwright

### Observability and Debugging

Parsers must emit structured logs:
- parser_start
- parser_success
- parser_failure
- parser_field_count
- parser_variant_used
- embedded_js_found
- embedded_js_missing

For failures:
- Save failing HTML under: `/tmp/mre/parsing-debug/YYYYMMDD-HHMMSS/`
- Save extracted JS blobs for review

### Backward Compatibility

Parser behaviour must remain stable across MRE v1.x.

Changes to:
- underlying parsing library
- CSS selectors
- embedded JS extraction strategy
- normalisation rules

must be documented and versioned.

Breaking changes require ingestion subsystem version bump.

### Security Hardening

Rules reflective of [Ingestion Security Hardening](08-ingestion-operations.md#security-hardening):
- No JS execution
- No unvalidated eval
- No remote script fetching
- No regex patterns with catastrophic backtracking
- No file writes outside debug directories
- No parser-level network requests

### Summary of Commitments

The parser layer must:
- Use selectolax
- Use strict, validated CSS selectors
- Use controlled regex for embedded JS
- Normalise and validate all fields
- Fail-fast on malformed upstream data
- Never execute JavaScript
- Never perform network access
- Produce deterministic results
- Integrate cleanly with fixtures and replay
- Emit rich observability data
