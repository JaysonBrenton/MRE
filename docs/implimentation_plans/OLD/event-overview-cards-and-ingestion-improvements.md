# Event Overview Cards and Ingestion Improvements – Implementation Plan

**Created**: 2026-02-02  
**Owner**: Frontend (Next.js) + Backend (Python Ingestion) + Database  
**Objective**: Implement four new Event Overview tab cards (Classes, Results, Total Entries, Top Qualifiers), persist race section/round from LiveRC, ingest full qualifying standings and Final Results page data for future use.

---

## 0. Guiding Goals

1. **Four new Overview cards** – Classes (count + list with drivers per class), Results (1st/2nd/3rd per main per class), Total Entries (total + by class), Top Qualifiers (top 3 per class from official qualifying order).
2. **Persist race section/round** – Capture which section each race came from on the event page (“Main Events”, “Qualifier Round 1”, “Qualifier Round 2”, “Qualifier Round 3”) and store it. Use for display and to define main vs qualifier.
3. **Top Qualifiers data** – Ingest **all** drivers in qualifying order per class (not just top 3). UI card shows top 3; stored data is full standings.
4. **Final Results page** – Ingest and store Final Results (Pos, Brand, Country, Driver, Result, Race) for future use.
5. **Backward compatibility** – Existing APIs and event analysis behaviour remain valid; new fields nullable where appropriate.
6. **API-first** – Business logic in `src/core/` and `ingestion/`; thin UI components.
7. **Docker-only** – All commands run inside Docker per project rules.

---

## 1. Scope Summary

| Deliverable | Data source | Prisma/DB change | Ingestion change | Frontend |
|-------------|-------------|------------------|------------------|----------|
| **Classes card** | Existing Race + RaceResult, EventRaceClass | No | No | New card + queries |
| **Results card** | Existing Race + RaceResult (filter mains by round/label) | No | No | New card + queries |
| **Total Entries card** | Existing EventEntry | No | No | New card + queries |
| **Top Qualifiers card** | New: Qual Points / Round Rankings | Yes (new model) | Yes (new parser + pipeline) | New card; show top 3 |
| **Race section/round** | Event page race list `<th>` rows | Yes (Race.roundLabel) | Yes (parser + normalizer + repo) | Surface round in UI |
| **Final Results** | New: event_overall_ranking page | Yes (new model) | Yes (new parser + pipeline) | Not in scope for v1 cards |

---

## 2. Database and Schema Changes

### 2.1 Add `roundLabel` to Race (Prisma + Ingestion DB)

**Purpose**: Persist the section heading from the LiveRC event page (“Main Events”, “Qualifier Round 1”, “Qualifier Round 2”, “Qualifier Round 3”) so we can surface it to users and distinguish mains from qualifier rounds.

**Prisma** – `prisma/schema.prisma`:

- In `Race` model, add:
  ```prisma
  roundLabel  String?   @map("round_label")  // e.g. "Main Events", "Qualifier Round 1"
  ```
- Add index for filtering by round (optional but useful):
  ```prisma
  @@index([roundLabel])
  @@index([eventId, roundLabel])
  ```

**Migration**:

- Name: `add_race_round_label`
- SQL: `ALTER TABLE "races" ADD COLUMN "round_label" TEXT;` (nullable, no backfill required).

**Ingestion (SQLAlchemy)** – `ingestion/db/models.py`:

- Add to `Race`:
  ```python
  round_label = Column("round_label", String, nullable=True)
  ```
- Add index in `__table_args__` if desired.

**Ingestion repository** – `ingestion/db/repository.py`:

- In `upsert_races` (or equivalent), include `round_label` in insert/update payload and in `on_conflict_do_update` update set.

---

### 2.2 New model: Qualifying Standing (full standings per class)

**Purpose**: Store the **full** qualifying order per class (all drivers), as shown on LiveRC “Qual Points (2 of 3)” and/or “Qualifier Round X Rankings”. The Top Qualifiers card will display top 3; the table holds everyone.

**Prisma** – `prisma/schema.prisma`:

- New model (name TBD; e.g. `EventQualifyingStanding` or `QualifyingStanding`):
  ```prisma
  model EventQualifyingStanding {
    id              String   @id @default(uuid())
    eventId         String   @map("event_id")
    className       String   @map("class_name")
    driverId        String   @map("driver_id")
    position        Int      // Overall qualifying position (# in Qual Points table)
    pointsRound1    Int?     @map("points_round_1")
    pointsRound2    Int?     @map("points_round_2")
    pointsRound3    Int?     @map("points_round_3")
    tieBreaker      String?  @map("tie_breaker")
    result          String?  // Raw "Result" column if present
    createdAt       DateTime @default(now()) @map("created_at")
    updatedAt       DateTime @updatedAt @map("updated_at")

    event           Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
    driver          Driver   @relation(fields: [driverId], references: [id], onDelete: Cascade)

    @@unique([eventId, className, driverId])
    @@index([eventId])
    @@index([eventId, className])
    @@map("event_qualifying_standings")
  }
  ```
- Add relation on `Event`: `qualifyingStandings EventQualifyingStanding[]`
- Add relation on `Driver`: `qualifyingStandings EventQualifyingStanding[]` (if not already present).

**Migration**: Create table `event_qualifying_standings` with above columns and constraints.

**Ingestion (SQLAlchemy)** – Add matching model in `ingestion/db/models.py` and repository methods to upsert qualifying standings (by eventId, className, driverId).

---

### 2.3 New model: Final Result (event_overall_ranking)

**Purpose**: Store Final Results page data (Pos, Brand, Country, Driver, Result, Race) for future use.

**Prisma** – `prisma/schema.prisma`:

- New model (e.g. `EventFinalResult`):
  ```prisma
  model EventFinalResult {
    id         String   @id @default(uuid())
    eventId    String   @map("event_id")
    className  String   @map("class_name")
    raceLabel  String?  @map("race_label")   // e.g. "A-Main", "B-Main"
    position   Int      @map("position")     // Pos
    driverId   String   @map("driver_id")
    brand      String?  @map("brand")
    country    String?  @map("country")
    result     String?  @map("result")       // Result column (e.g. laps/time)
    createdAt  DateTime @default(now()) @map("created_at")
    updatedAt  DateTime @updatedAt @map("updated_at")

    event      Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
    driver     Driver   @relation(fields: [driverId], references: [id], onDelete: Cascade)

    @@unique([eventId, className, raceLabel, driverId])  // or composite that matches one row per main per driver
    @@index([eventId])
    @@index([eventId, className])
    @@map("event_final_results")
  }
  ```
- Uniqueness depends on LiveRC structure (one row per driver per main per class). Adjust `@@unique` after inspecting Final Results HTML (e.g. may need raceId or raceLabel in key).

**Migration**: Create table `event_final_results`.

**Ingestion (SQLAlchemy)** – Add matching model and repository upsert for final results.

---

## 3. Ingestion Pipeline Changes

### 3.1 Persist race section/round (roundLabel)

**LiveRC structure**: On the event page, the “Race Results” table (`table.entry_list_data`) has rows:

- Header rows: `<tr><th>Main Events</th><th>Time Completed</th></tr>`, `<tr><th>Qualifier Round 3</th>...</tr>`, etc.
- Data rows: `<tr><td><a href="...view_race_result...">Race N: ...</a></td>...</tr>`.

**Requirement**: When iterating rows, treat a row that has `<th>` in the first cell as the “current section” and assign that text (e.g. “Main Events”, “Qualifier Round 1”) to all following race rows until the next section header.

**Files to change**:

1. **Connector model** – `ingestion/connectors/liverc/models.py`
   - Add to `ConnectorRaceSummary`: `round_label: Optional[str] = None`.

2. **Race list parser** – `ingestion/connectors/liverc/parsers/race_list_parser.py`
   - Iterate `table.entry_list_data tbody tr`.
   - If row has `th`: set `current_section = row.css_first("th").text().strip()` and continue (do not emit a race).
   - If row has race link: build `ConnectorRaceSummary` as today and set `round_label=current_section` (ensure `current_section` is initialised before any data row, e.g. to empty string or “Unknown” for events that don’t use section headers).
   - Return list of races, each with `round_label` set.

3. **Normalizer** – `ingestion/ingestion/normalizer.py`
   - In `normalize_race()`, add `"round_label": race.round_label` (or equivalent from connector model) to the returned dict.

4. **Pipeline** – `ingestion/ingestion/pipeline.py`
   - Ensure the normalized race dict passed to repository includes `round_label`.

5. **Repository** – `ingestion/db/repository.py`
   - In race upsert, include `round_label` in insert and in `on_conflict_do_update` update set.

6. **Parser docs** – `ingestion/connectors/liverc/PARSER_SELECTORS.md` (and any similar docs)
   - Document that race list parser now extracts section/round from `<th>` and populates `round_label`.

**Tests**: Add/update unit tests in `ingestion/tests/unit/test_race_list_parser.py` for section headers and that each race gets the correct `round_label`.

---

### 3.2 Ingest Qual Points / Qualifier Round Rankings (full standings)

**Requirement**: Ingest **all** drivers in qualifying order per class, not just top 3. Stored data = full standings; UI will show top 3.

**LiveRC pages** (from event page “Overall Results & Rankings”):

- “Qual Points (2 of 3)” – `view_points?id=...` – table: #, Driver, Result, Tie Breaker, Round 1, Round 2, Round 3.
- “Qualifier Round 1/2/3 Rankings” – `view_round_ranking?id=...&o=laps_time` – driver order after that round.

**Recommended approach**: Prefer parsing **Qual Points** (`view_points`) when available, so we have one table per class with position and round points. If Qual Points is not present for some events, consider parsing the latest “Qualifier Round N Rankings” (`view_round_ranking`) for each class as fallback. Plan below assumes Qual Points as primary.

**Tasks**:

1. **Discover links on event page**
   - In event page parser (or in pipeline when processing event HTML), collect:
     - Link to “Qual Points” (`view_points`) – may be one per event or one per class; document after inspecting HTML.
     - Links to “Qualifier Round N Rankings” (`view_round_ranking`) for N=1,2,3.
   - Store in a structure (e.g. event metadata or connector response) so the pipeline can fetch these URLs.

2. **New parser: Qual Points** – `ingestion/connectors/liverc/parsers/qual_points_parser.py` (or similar name)
   - **Page**: `https://{track_slug}.liverc.com/results/?p=view_points&id={points_id}`.
   - **Input**: HTML, URL, source_event_id.
   - **Output**: List of per-class standings: e.g. `[{ "class_name": "...", "standings": [{ "position": 1, "driver_name": "...", "source_driver_id": "...", "result": "...", "tie_breaker": "...", "round1": ..., "round2": ..., "round3": ... }, ... ] }]`.
   - Parse **all** rows in each class table (not just top 3). Driver ID: match by name to existing Driver records or use source_driver_id if present in HTML (e.g. from links).
   - Document selectors in `PARSER_SELECTORS.md`.

3. **Connector**
   - Add method to fetch Qual Points page(s) (e.g. `get_qual_points(event_page_html, event_url)` to resolve URLs, then `fetch_qual_points(url)`).
   - Or: pipeline discovers `view_points` URL from event page, connector fetches by URL.

4. **Normalizer**
   - Map connector output to list of qualifying standing records (eventId, className, driverId, position, pointsRound1, pointsRound2, pointsRound3, tieBreaker, result). Resolve driverId by name/source_driver_id (create or link Driver as in existing pipeline).

5. **Repository**
   - Upsert `EventQualifyingStanding` (or ingestion DB equivalent) by (eventId, className, driverId). Replace or merge standings for the event/class when re-ingesting.

6. **Pipeline**
   - After races (and race results) are ingested, fetch Qual Points (and optionally round rankings), parse, normalize, upsert qualifying standings. If multiple view_points links (e.g. per class), fetch all and merge.

7. **Fixtures and tests**
   - Add HTML fixture for at least one `view_points` page (and optionally `view_round_ranking`).
   - Unit tests for parser and integration test for “event ingest includes qualifying standings”.

**Edge cases**: Event with no Qual Points (e.g. no heats); treat as no qualifying data and leave standings empty. Do not assume top 3 only; always store full list.

---

### 3.3 Ingest Final Results (event_overall_ranking)

**Requirement**: Ingest Final Results page so we have Pos, Brand, Country, Driver, Result, Race for later use.

**LiveRC page**: “Final Results” – `event_overall_ranking?id={event_id}`. Structure: by class, then by main (A-Main, B-Main, etc.), table columns e.g. Pos, Brand, Country, Driver, Result, Race.

**Tasks**:

1. **Discover link**
   - Event page “Overall Results & Rankings” contains a link to Final Results. Parse event page to get `event_overall_ranking` URL (same event id as event).

2. **New parser: Final Results** – `ingestion/connectors/liverc/parsers/final_results_parser.py`
   - **Page**: `https://{track_slug}.liverc.com/results/?p=event_overall_ranking&id={event_id}`.
   - **Output**: Per class, per main (race label): list of rows with position, driver (name/id), brand, country, result, race label. Match drivers to existing Driver records by name/transponder where possible.
   - Document selectors; add fixture from real event if possible.

3. **Connector**
   - Add fetch for Final Results URL (e.g. `fetch_final_results(url)`).

4. **Normalizer**
   - Map to list of final result records (eventId, className, raceLabel, position, driverId, brand, country, result).

5. **Repository**
   - Upsert `EventFinalResult` (or ingestion equivalent) with uniqueness as defined in schema (e.g. eventId + className + raceLabel + driverId).

6. **Pipeline**
   - After races (and optionally after qualifying standings), fetch Final Results, parse, normalize, upsert. Run after race results so driver IDs exist.

7. **Tests and fixtures**
   - Fixture HTML for one event_overall_ranking page; unit test for parser.

---

## 4. API and Core Logic (Next.js)

### 4.1 Data for Classes card

- **Source**: Existing Prisma: `EventRaceClass` (or distinct classes from `Race`), and distinct drivers who have at least one `RaceResult` in that class (e.g. join Race → RaceResult → Driver, filter by eventId and className, count distinct driverId). “Drivers who actually raced” = drivers with at least one result in that class.
- **Location**: Extend `get-event-analysis-data` or add a small helper used by the Overview tab. Return: `{ classes: [{ className, driverCount }, ...], totalClasses: number }`.

### 4.2 Data for Results card (main podiums)

- **Source**: Races where `roundLabel === "Main Events"` (or, fallback, where `raceLabel` contains “Main” and not “Heat”). For each such race: `RaceResult` with `positionFinal` 1, 2, 3; include driver name and race label.
- **Location**: Same core module. Return: `{ mainPodiums: [{ raceId, raceLabel, className, results: [{ position, driverId, driverName }] }] }` (or similar). Order by race order/start time.

### 4.3 Data for Total Entries card

- **Source**: `EventEntry`: total count for event; count by `className` (or by eventRaceClassId). Use existing entry list data.
- **Location**: Same core module. Return: `{ totalEntries: number, entriesByClass: [{ className, count }] }`.

### 4.4 Data for Top Qualifiers card

- **Source**: New table `EventQualifyingStanding` (or Prisma model name chosen). For event and optionally selected class: order by `position` ascending, take full list (API can return all; UI shows top 3). Return: `{ qualifyingStandings: [{ className, position, driverId, driverName, pointsRound1, pointsRound2, pointsRound3, ... }] }` grouped or filterable by class.
- **Location**: New or extended core function; ensure event analysis API or Overview tab can request this. If qualifying data is missing for an event, return empty array.

### 4.5 Exposing roundLabel

- **Source**: `Race.roundLabel` from Prisma. Include in any API that returns race list for the event (e.g. sessions, race list for Overview). So frontend can show “Main Events”, “Qualifier Round 2”, etc.

### 4.6 Final Results

- No new API for v1 cards; data is stored for later. When building features that need Brand/Country/Result, add a core function that reads from `EventFinalResult`.

---

## 5. Frontend (Event Overview Tab)

### 5.1 New cards (order and placement)

Add four new card sections to the Event Overview tab (e.g. after “Event Statistics” and before or after “Chart Configuration” / “Driver Statistics”), consistent with existing layout (e.g. `EventStats`-style grid or list):

1. **Classes** – Title “Classes”. Show total number of classes. List each class with “X drivers” (drivers who actually raced). Use data from §4.1.
2. **Results** – Title “Results” (or “Main Results”). Subheading clarifying “1st, 2nd, 3rd per main (no heats)”. For each class, list mains (e.g. A-Main, B-Main, C-Main) and under each the top 3 drivers. Use data from §4.2.
3. **Total Entries** – Title “Total Entries”. Total count and breakdown by class. Use data from §4.3.
4. **Top Qualifiers** – Title “Top Qualifiers”. Per class, show top 3 drivers (position + name; optional: points or round breakdown). Use data from §4.4. If no qualifying data, show message “No qualifying data for this event.”

### 5.2 Components

- Prefer reusable card/section components (e.g. bordered section with title) consistent with `EventStats`. Create or reuse:
  - `ClassesCard.tsx`, `ResultsCard.tsx`, `TotalEntriesCard.tsx`, `TopQualifiersCard.tsx` (or single `EventOverviewCards.tsx` that composes them).
- Each card receives data from the parent (Overview tab); parent fetches via existing or new API that aggregates the four data sets (§4.1–4.4).

### 5.3 Surfacing round (section) to the user

- Wherever race lists or session lists are shown (e.g. Sessions tab, race selector, or session details), include `roundLabel` (e.g. “Main Events”, “Qualifier Round 1”) so users see which section/round each race belongs to. Use `Race.roundLabel` from API; no new backend work beyond §2.1 and §4.5.

### 5.4 Main vs qualifier

- Use `roundLabel` to define “main” vs “qualifier”: e.g. `roundLabel === "Main Events"` → main; `roundLabel` starting with “Qualifier Round” → qualifier. Use this in logic (e.g. Results card, filters) instead of inferring only from “Heat”/“Main” in `raceLabel` where possible.

---

## 6. Testing and Quality

- **Ingestion**
  - Unit tests: race list parser with section headers; Qual Points parser (full table); Final Results parser.
  - Integration: run event ingestion for an event that has Main Events, Qualifier Rounds, Qual Points, and Final Results; assert races have `roundLabel`, qualifying standings table is fully populated (all drivers), and final results table is populated.
- **API**
  - Test that event analysis (or new endpoint) returns classes, main podiums, entries, and qualifying standings; and that race payloads include `roundLabel`.
- **Frontend**
  - Render the four cards with real or mocked data; verify Top Qualifiers shows only top 3 while API returns full list; verify round label appears where race lists are shown.

---

## 7. Documentation and Docs Updates

- **Parser docs** – `ingestion/connectors/liverc/PARSER_SELECTORS.md`: document race list `round_label` extraction; add sections for Qual Points and Final Results parsers (selectors, URL format, output shape).
- **Implementation status** – `ingestion/PARSER_IMPLEMENTATION_STATUS.md`: add Qual Points and Final Results parsers and pipeline steps.
- **ADR (optional)** – If you keep ADRs for schema/ingestion, add one for “Event Overview cards and ingestion: roundLabel, qualifying standings, final results.”

---

## 8. Implementation Order (Suggested)

1. **DB: Race.roundLabel** – Prisma + migration; ingestion SQLAlchemy model + repository; then parser + normalizer + pipeline (§2.1, §3.1). Test with existing events.
2. **Classes, Results, Total Entries cards** – API + frontend only (§4.1–4.3, §5.1–5.2). Use existing data; Results uses `roundLabel` or raceLabel fallback for “main”.
3. **DB: QualifyingStanding + FinalResult** – Prisma migrations and ingestion models (§2.2, §2.3).
4. **Ingestion: Qual Points** – Parser, connector, normalizer, repository, pipeline (§3.2). Ensure **all** drivers are stored.
5. **Ingestion: Final Results** – Parser, connector, normalizer, repository, pipeline (§3.3).
6. **API: Top Qualifiers** – Expose qualifying standings; UI shows top 3 (§4.4, §5.1).
7. **UI: surface roundLabel** – Wherever race/session lists are shown (§5.3, §4.5).
8. **Tests and docs** – §6 and §7.

---

## 9. Out of Scope (This Plan)

- Changes to Driver matching or transponder logic beyond what’s needed to link qualifying/final result rows to drivers.
- Ingesting “view_multi_main_result” pages (we use race results + roundLabel for main podiums).
- Brand/Country/Result in the first version of the Results card (data is stored for later use).
- Backfilling `roundLabel` for previously ingested events (optional follow-up).

---

**Document version**: 1.0  
**Last updated**: 2026-02-02
