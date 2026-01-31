---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: Browser strategy for LiveRC connector scraping operations
purpose:
  Defines when and why the LiveRC connector uses a real browser (Playwright)
  instead of HTTPX, specifying browser usage rules, anti-bot safety measures,
  deterministic output requirements, and minimal resource consumption
  strategies.
relatedFiles:
  - docs/architecture/liverc-ingestion/01-overview.md
  - docs/architecture/liverc-ingestion/02-connector-architecture.md
  - docs/architecture/liverc-ingestion/09-connector-contracts.md
  - docs/specs/mre-v0.1-feature-scope.md
---

# 10. Connector Browser Strategy (LiveRC Scraper Subsystem)

This document defines _exactly when and why_ the LiveRC connector uses a real
browser (Playwright) instead of HTTPX, and how the connector must behave to
ensure reliability, anti-bot safety, deterministic output, and minimal
operational complexity.

This document governs the scraping layer only. It MUST NOT include ingestion or
database behaviour.

---

## 1. Goals of the Browser Strategy

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

The connector MUST hide all browser decisions behind simple function calls such
as `fetch_event_page` and `fetch_race_page`.

---

## 2. Overview of LiveRC Content Types

The connector must treat LiveRC pages as belonging to one of the following:

### 2.1 Static Pages (easy to scrape)

Examples:

- `https://TRACK.liverc.com/events`
- `https://TRACK.liverc.com/results/?p=view_event&id=XXXXX`
- Most race result pages

These pages:

- Return predictable HTML
- Do not require JavaScript rendering
- Are fully retrievable with HTTPX

### 2.2 Dynamic Pages (require browser)

Examples:

- Pages where the “View Laps” table loads only after a user action
- Pages where HTML sections expand via JavaScript
- Pages that detect bots based on HTTP patterns and require a JS environment

These require Playwright.

### 2.3 Hybrid Pages

Some pages are static for metadata but dynamic for lap detail.

The browser strategy MUST handle this distinction automatically.

---

## 3. Strict Rule: Playwright Only for One Type of Page

The overall design goal is:

**“Use Playwright for exactly one page per race.”**

Specifically:

- The _race result page_ (with lap tables) is the page most likely to require
  JavaScript-driven content.
- All other pages are handled by HTTPX unless proven otherwise.

This rule drastically simplifies the connector design.

---

## 4. Decision Tree: HTTPX or Playwright?

The connector MUST follow this decision tree internally for each page:

### Step 1 — Try HTTPX

If the HTML already contains:

- race result tables
- lap data containers
- event metadata fields
- race list entries

…then use the HTTPX response.

### Step 2 — Check for dynamic dependencies

If the elements are missing or collapsed behind anchors such as:

- `View Laps`
- `.panel-collapse`
- JavaScript-driven tab sections

…then Playwright MUST be used.

### Step 3 — Detect anti-bot protections

LiveRC may:

- delay JS execution
- hide certain tables until JS evaluates
- throttle “too fast” fetches

When HTTPX-based parsing fails consistently for a given page type, the connector
MUST escalate that page type to ALWAYS use Playwright.

### Step 4 — Cache page classification

If a page type consistently requires Playwright, the connector MAY maintain a
lookup table so ingestion becomes deterministic and faster.

This table MUST live inside the connector module, not the ingestion system.

---

## 5. Playwright Operational Rules

When Playwright is used, the connector MUST:

1. Launch a **headless Chromium instance** with:
   - realistic User-Agent
   - moderate simulated typing/mouse delays disabled (not needed)
   - standard viewport size
   - JS enabled

2. Wait for specific selectors before extraction:
   - result tables (e.g. `table.table-striped`)
   - lap tables within driver sections
   - `div.panel-body` for “View Laps”

3. Extract final DOM state, never raw content.

4. Immediately close the browser context after scraping one page.

5. Not throttle itself; the ingestion orchestrator handles rate limiting.

### 5.1 Forbidden Playwright Usage

The connector MUST NOT:

- keep long-running browser instances alive between events
- navigate multiple pages within the same context
- click UI elements other than “expand laps”
- store screenshots or logs beyond debug mode

---

## 6. HTTPX Operational Rules

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

---

## 7. Anti-Bot Safety Strategy

The connector MUST adhere to these safety rules:

1. **Low-frequency ingestion**  
   Ingestion runs happen only when an admin triggers them.

2. **Natural-looking request patterns**  
   The connector MUST NOT flood LiveRC with parallel requests.

3. **Use browser only when necessary**  
   Playwright mimics a real browser, reducing anti-bot risk.

4. **Retry with backoff**  
   HTTPX and Playwright fetch failures MUST use exponential backoff before
   raising errors.

5. **Avoid suspicious automation signals**  
   No automation headers. No odd request patterns. No manipulating cookies.

This strategy is not about _evading protections_, but ensuring _cooperative
polite scraping_.

---

## 8. Page-Type-to-Tool Matrix

| Page Type                    | HTTPX | Playwright | Notes                                        |
| ---------------------------- | ----- | ---------- | -------------------------------------------- |
| Track list (live.liverc.com) | Yes   | No         | Static content                               |
| Event list (/events)         | Yes   | No         | Simple table                                 |
| Event detail                 | Yes   | Maybe      | If races hidden behind JS                    |
| Race summary                 | Yes   | No         | Often complete HTML                          |
| Race results with lap tables | Maybe | Yes        | This is the one page that typically needs JS |
| Individual lap sections      | No    | Yes        | Anchor expansion via JS                      |

The connector MUST optimise for the above behaviours.

---

## 9. Failure Recovery Rules

If a Playwright scrape fails:

- Retry with a new browser context
- Then retry with exponential backoff
- If still failing, raise a _connector-specific_ error (never raw Playwright)

The ingestion pipeline will:

- abort the event ingestion
- leave DB unchanged
- propagate a clean error to the CLI or API caller

---

## 10. Future Evolution

The browser strategy must allow clean extension:

1. Using local browser persistence to speed up multi-page crawls
2. Using a pool of pre-warmed browser instances
3. Supporting alternative browser engines (WebKit, Firefox)
4. Integrating a per-domain rate limiter

All extensions MUST preserve:

- deterministic parsing
- connector purity (no DB)
- minimal browser usage

---

End of 10-connector-browser-strategy.md.
