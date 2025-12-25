---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: Replay and debugging strategy for LiveRC ingestion operations
purpose: Defines the complete debugging and replay strategy for the LiveRC ingestion
         subsystem, enabling deterministic debugging, regression triage, fixture evolution,
         and reproducible ingestion outcomes. Allows developers to reproduce any ingestion
         result exactly at any point in time.
relatedFiles:
  - docs/architecture/liverc-ingestion/01-overview.md
  - docs/architecture/liverc-ingestion/03-ingestion-pipeline.md
  - docs/architecture/liverc-ingestion/15-ingestion-observability.md
  - docs/architecture/liverc-ingestion/19-ingestion-fixture-management.md
  - docs/architecture/liverc-ingestion/21-ingestion-recovery-procedures.md
  - docs/specs/mre-v0.1-feature-scope.md
---

# 20. Ingestion Replay and Debugging (LiveRC Ingestion Subsystem)

This document defines the complete debugging and replay strategy for the LiveRC ingestion subsystem in My Race Engineer (MRE). Replayability is essential for deterministic debugging, regression triage, fixture evolution, and continuous development of the ingestion pipeline. This subsystem must allow developers to reproduce any ingestion outcome—success or failure—exactly, at any point in time.

This document covers:

- fixture-based replay engine  
- multi-stage replay modes  
- debugging connectors (HTTPX and Playwright)  
- debugging parser and normaliser layers  
- debugging nondeterministic behaviour  
- ingestion diff tooling  
- recommended debugging workflows in Cursor  
- error triage ladders  
- how to isolate upstream HTML changes  
- how to manually inspect race and lap data  

---

## 1. Principles of Replay and Debugging

1. Ingestion must be **fully reproducible** using stored fixtures.  
2. Replay must allow **running ingestion without network access**.  
3. Debugging must be **modular**, allowing partial pipeline execution.  
4. All failures must leave behind **observable artefacts**, including logs, snapshots, and error envelopes.  
5. Debug workflows must avoid mutating the database unless explicitly enabled.  
6. Replay must verify **idempotency, determinism, and consistency**.  
7. Replay and debugging tools must remain connector-agnostic.

---

## 2. Replay Modes

Replay supports four levels of execution. These modes allow developers to isolate problems precisely.

### 2.1 Full Replay Mode (End-to-End)

Runs the entire ingestion pipeline using fixtures:

- load event fixture  
- load race fixtures  
- load lap fixtures  
- execute parsing, normalisation, and persistence  
- validate results  
- emit logs and metrics  

Used for:

- regression verification  
- debugging complete ingestion failures  
- performance analysis

### 2.2 Fetch-Only Replay (Connector Isolation)

Verifies that fixture selection is correct:

- load fixture HTML  
- bypass parsers  
- output raw HTML snapshot  
- validate connector integrity  

Used for:

- testing fixture structure  
- debugging missing or malformed fixture files  
- verifying Playwright snapshots

### 2.3 Parse-Only Replay (Parser Isolation)

Runs only:

- HTML parsing  
- racerLaps extraction  
- race metadata extraction  
- lap struct extraction  
- parser output displayed in JSON  

Used for:

- diagnosing DOM changes  
- debugging broken selectors  
- verifying extraction logic

### 2.4 Normalisation-Only Replay (Pipeline Sanity)

Runs only:

- normalisation logic  
- field coercion  
- canonical form construction  

Used for:

- verifying format conversions  
- debugging lap time parsing  
- ensuring canonical race ordering  

### 2.5 Persist-Only Replay (DB Testing)

Runs only:

- DB inserts  
- DB updates  
- constraint validation  
- idempotency checks  

Used for:

- validating schema integrity  
- debugging data mismatches  
- ensuring no duplicates are inserted  

---

## 3. Debugging Connector Issues

### 3.1 HTTPX Debugging

Debugging symptoms:

- empty response  
- truncated HTML  
- missing racerLaps arrays  
- inconsistent load times  
- upstream server rejection  

Debug procedure:

1. capture the raw HTTP response to a file  
2. compare against known-good fixtures  
3. inspect headers for anti-bot indicators  
4. check CDN caching anomalies  
5. verify URL construction  
6. replay fetch-only mode  
7. replace with Playwright-mode fixture if JS content is missing  

### 3.2 Playwright Debugging

Symptoms:

- DOM not rendered in time  
- missing results tables  
- infinite loading spinners  
- JS errors in page context  
- script injecting dynamic content out of order  

Debug procedure:

1. enable playwright debug mode (DevTools)  
2. inspect DOM live  
3. test alternative selectors  
4. capture snapshots before and after selector waits  
5. verify deterministic HTML—strip volatile DOM elements  
6. promote snapshot to fixture if stable  

Playwright snapshotting must be done once per race unless upstream HTML changes.

---

## 4. Debugging Parser and Normaliser Layers

### 4.1 Steps for Parser Isolation

1. run parser-only mode using fixture HTML  
2. output structured extraction:
   - races  
   - results  
   - lap arrays  
3. compare output against expected parser snapshots  
4. identify missing fields or array length mismatches  
5. locate DOM changes in source HTML  

### 4.2 Common Parser Failures

- changed class names or IDs  
- new wrapper elements added by LiveRC  
- JS blocks reordered  
- race labels changed format  
- lap arrays missing a field  

Parser tests MUST fail loudly and immediately.

### 4.3 Normaliser Debugging

Symptoms:

- wrong durations  
- off-by-one lap numbers  
- incorrect race ordering  
- incorrect driver identities  
- inconsistent pace strings  

Normaliser debugging steps:

1. run normalisation-only replay  
2. print canonical intermediate representation  
3. confirm:
   - lap_time_seconds  
   - elapsed times  
   - ordering  
   - null handling  

All transformations must be deterministic.

---

## 5. Debugging Nondeterministic Behaviour

Nondeterminism may appear in:

- JS-rendered snapshot differences  
- inconsistent HTML ordering  
- variable whitespace in JS arrays  
- CDN caching differences  
- race “order of appearance” variations  

Debug checklist:

- re-run ingestion 3 times and diff outputs  
- enable deterministic sorting of races in normaliser  
- normalise whitespace in JS arrays  
- trim CDNs injecting timestamps  
- use canonical fixture snapshots  

No nondeterministic behaviour is allowed in final ingestion output.

---

## 6. Ingestion Diff Tooling

A diff tool must be provided to compare:

- ingestion outputs (race, results, laps)  
- fixture vs live HTML  
- parser output vs expected snapshots  
- normalised output vs canonical JSON  

Diff tool outputs must include:

- added fields  
- removed fields  
- changed values  
- ordering differences  
- lap count differences  

Diffing must produce a readable summary for developers.

---

## 7. Debugging Steps in Cursor

Recommended Cursor workflows:

### 7.1 “Open fixture + run parser” loop

1. open fixture HTML side-by-side with parsing code  
2. troubleshoot selectors  
3. replay parser-only  

### 7.2 Step-by-step pipeline walkthrough

Cursor can:

- open parser file  
- generate debugging snippets  
- run fixed replay steps  
- surface diffs inline  

### 7.3 Automated snapshot testing in Cursor

Cursor must run snapshot tests automatically when committing ingestion code.

---

## 8. Debugging Live Upstream Issues

When LiveRC changes upstream HTML:

1. ingestion regression tests fail  
2. developer opens failing fixture test logs  
3. diff reveals missing DOM nodes or changed structures  
4. update parser logic  
5. regenerate snapshots  
6. bump fixture_version  
7. run full replay to confirm all events pass  

This avoids production surprises.

---

## 9. Debugging Lap Data

Lap debugging steps:

1. extract raw lap array from racerLaps JS  
2. convert to intermediate JSON  
3. normalise to canonical lap rows  
4. manually verify:
   - lap_number  
   - position_on_lap  
   - elapsed time accumulation  
   - consistency metrics  
5. compare against expectations  
6. diff against prior ingest  

Lap mismatches are the most common ingestion bugs.

---

## 10. DB Debugging Procedures

### 10.1 Inspect Intermediate Writes

Use debug mode to:

- preview inserts  
- preview updates  
- verify foreign keys  
- validate idempotency  

### 10.2 Validate Race and Lap Counts

DB validation must confirm:

- race_count == expected  
- lap_count == expected for every driver  
- positions match ordering  

If mismatches appear, isolate:

- parser  
- normaliser  
- fixture correctness  
- DB writes  

---

## 11. Debugging Concurrency and Locking

Replay concurrency tests must validate:

- ingestion lock acquisition  
- correct rejection of simultaneous ingestion  
- lock release on failure  
- lock timeout handling  

Tools for debugging:

- lock state inspector  
- ingestion audit log viewer  
- concurrency test harness  

---

## 12. Debug Mode

Ingestion supports a debug mode with:

- verbose logs  
- HTML snapshots  
- parsed output dumps  
- normalised output dumps  
- race and lap validation summaries  
- playwright screenshot capture  

Debug mode must never run in production.

---

## 13. Developer Debugging Ladder (Recommended Process)

When ingestion fails:

1. run fixture replay  
2. inspect logs  
3. inspect parser output  
4. diff normalised output  
5. compare against canonical snapshot  
6. inspect fixture HTML  
7. inspect live HTML (optional)  
8. run parser-only  
9. fix selectors or parser logic  
10. regenerate snapshots  
11. confirm determinism across multiple runs  
12. commit changes with fixture version bump  

This ensures stable, predictable ingestion.

---

## 14. Long-Term Debugging Enhancements

Future improvements:

- ingestion visual diff tool  
- HTML DOM tree diff visualiser  
- racerLaps array validator tool  
- fix recommendation engine powered by an LLM  
- upstream change monitoring system  
- ingestion replay orchestrated tests for multiple connectors  

These will strengthen system resilience.

---

End of 20-ingestion-replay-and-debugging.md.
