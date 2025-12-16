---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: Cross-connector abstractions for multi-source ingestion support
purpose: Defines shared abstractions, interfaces, and conventions enabling multiple
         ingestion connectors to coexist under a unified framework. Ensures future data
         sources can be added with minimal friction without modifying core ingestion logic.
relatedFiles:
  - docs/architecture/liverc-ingestion/01-overview.md
  - docs/architecture/liverc-ingestion/02-connector-architecture.md
  - docs/architecture/liverc-ingestion/09-connector-contracts.md
  - docs/specs/mre-alpha-feature-scope.md
---

# 23. Ingestion Cross-Connector Abstractions

This document defines the shared abstractions, interfaces, and conventions that allow multiple ingestion connectors to coexist under a unified framework. The aim is to ensure that future data sources can be added to the My Race Engineer (MRE) ingestion ecosystem with minimal friction, without modifying core ingestion logic.

The abstractions defined here form the contract between:

- the ingestion pipeline
- the connector registry
- individual connectors
- the persistence layer
- the browser and HTTP fetch subsystems

They guarantee stability, determinism, and a consistent developer experience across multiple data sources.

---

## 1. Goals of Cross-Connector Abstraction

The ingestion engine must:

- Treat each data source (LiveRC or otherwise) as a modular, swappable component.
- Provide a unified interface for discovery, fetching, parsing, normalisation, and persistence.
- Guarantee that ingestion behaviour remains consistent across connectors.
- Enforce versioning and backward compatibility.
- Allow connectors to evolve independently from the ingestion core.
- Support different capabilities (HTTP-only, browser-required, mixed-mode, streaming, paginated sources).
- Enable clear validation, error-handling, and replay semantics.

The system must scale to many connectors without rewriting ingestion logic.

---

## 2. Connector Registry

MRE maintains a registry of all available connectors. Each connector registers:

- source key (example: liverc)
- human-readable source name
- connector version (semantic versioning)
- supported operations (historical ingestion, live ingestion, partial ingestion)
- browser usage characteristics (never, always, conditional)
- supported entity types (tracks, events, races, results, laps)
- required configuration (API keys, rate limits, fetch settings)
- failure modes and retry behaviour

The registry is the ingestion engine’s source of truth for routing operations to the correct connector.

The ingestion engine queries this registry before performing any ingestion step.

---

## 3. Connector Interface Requirements

All connectors must implement the following interfaces, even if implemented as no-op functions when unsupported:

1. resolve_track_url(slug)
2. resolve_event_url(external_id)
3. fetch_track_index()
4. fetch_event_index(track)
5. fetch_event_metadata(event)
6. fetch_race_index(event)
7. fetch_race_results(race)
8. fetch_lap_data(race_result)
9. normalise_track(raw)
10. normalise_event(raw)
11. normalise_race(raw)
12. normalise_race_result(raw)
13. normalise_laps(raw)
14. validate_raw(raw)
15. validate_normalised(data)
16. detect_html_schema(raw_html)
17. detect_js_schema(raw_js)
18. connector_capabilities()

Connectors that do not support a given operation must still implement the method and return an appropriate capability error.

Every connector method must be deterministic for the same inputs.

---

## 4. Shared Entity Model Across Connectors

All connectors must produce the same normalised schema for:

- Track
- Event
- Race
- RaceResult
- RaceDriver
- Lap

Normalisation rules ensure:

- consistent field names
- consistent units (seconds, dates, integers)
- consistent ordering (lap_number ascending, position ascending)
- stable identifiers (source-specific, connector-scoped)
- consistent handling of missing or malformed data

Normalization isolates the rest of the system from HTML or JavaScript variability.

---

## 5. Capability Model

Connectors may support different ingestion patterns. Capability flags allow the ingestion engine to choose the correct logic flow.

Examples:

- supports_historical: true or false
- supports_live: true or false
- requires_browser: never, always, conditional
- provides_track_list: true or false
- provides_event_list: true or false
- provides_race_list: true or false
- provides_lap_data: true or false

Capabilities MUST be documented and versioned. Connectors must behave consistently with their published capabilities.

---

## 6. Connector Versioning and Compatibility

Each connector must declare a semantic version. Changes must follow:

- Patch: internal fixes, no schema changes.
- Minor: new optional fields, new capabilities.
- Major: breaking schema changes, new ingestion states, or incompatible behaviours.

The ingestion engine must reject incompatible major versions unless explicitly permitted.

Connectors must guarantee backward compatibility for a full major version cycle.

---

## 7. Unified Error Model

All connectors must raise errors using a shared taxonomy:

- NetworkError
- BrowserError
- SchemaMismatchError
- ParsingError
- ValidationError
- CapabilityError
- NotImplementedForSource
- UnexpectedFormatError
- IngestionInvariantError

Errors must include:

- source
- connector version
- stage (fetch, parse, normalise, persist)
- relevant identifiers (event_id, race_id, driver_id)
- human-readable message

Errors must be deterministic and reproducible.

---

## 8. Deterministic Processing Rules

All connectors must adhere to:

- idempotent ingestion of all entities
- deterministic ordering of outputs
- stable identifiers
- no data truncation
- strict validation before persistence
- consistent time formats and parsing rules
- normalised numeric fields (floats, ints)
- deterministic failure modes

This ensures ingestion runs produce byte-identical outputs when fed the same raw data.

---

## 9. Browser and HTTP Subsystem Abstractions

Connectors may request data through:

- fetch_http(url)
- fetch_html(url)
- fetch_dom(url)
- fetch_js_context(url)
- fetch_via_browser(url, options)

The ingestion engine decides whether to use:

- HTTPX (fast path)
- Playwright (fallback or required path)
- Cached fixtures (debug mode)
- Recorded DOM snapshots

Connectors must not import browser libraries directly. They request capabilities through abstract interfaces.

---

## 10. Cross-Connector Normalisation Rules

The ingestion engine enforces shared normalisation behaviour:

- Dates normalised to UTC ISO8601
- Times normalised to seconds (float)
- Lap numbers sequential from 1
- Drivers normalised to a stable display_name
- Missing driver IDs handled consistently
- All URLs absolute and canonical
- Derived fields (e.g., elapsed_time) computed consistently

Normalisation isolates the frontend from differences between connectors.

---

## 11. Extensibility Requirements

A new connector must be addable by:

- declaring metadata in the registry
- implementing the required interface functions
- adding test fixtures
- adding schema validation rules
- adding error-mapping rules

No ingestion engine code should need modification to support a new connector, unless the connector introduces a new domain concept.

---

## 12. Cross-Connector Testing Requirements

All connectors must conform to shared automated tests:

- interface compliance
- deterministic output
- normalisation invariants
- schema validation
- error taxonomy compliance
- replay reproducibility
- browser fallback tests
- fixture-based ingestion simulations

These tests ensure that ingestion behaves identically regardless of data source.

---

## 13. Observability Integration

All connectors must emit:

- structured logs (JSON)
- connector version
- timing metrics
- fetch vs parse vs normalise durations
- error events with full attribution
- invariant violations
- ingestion lifecycle events

Logs must be uniform across connectors.

---

## 14. Security Requirements

Connectors must:

- avoid arbitrary code execution
- sandbox JS evaluation
- avoid untrusted inline scripts
- never eval HTML or JS
- validate URLs before fetching
- respect ingestion rate limits
- avoid exposing internal structure in error messages

Security is mandatory and versioned along with capabilities.

---

## 15. Summary

This document defines the standards that all ingestion connectors must follow. By enforcing unified abstractions, capability models, deterministic behaviour, error taxonomies, and normalisation rules, MRE ensures that ingestion remains stable, maintainable, extensible, and predictable across multiple data sources.

This abstraction layer is critical to supporting additional connectors beyond LiveRC in future versions of the system.

