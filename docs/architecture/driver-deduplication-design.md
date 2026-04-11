---
created: 2026-02-20
creator: Jayson Brenton
lastModified: 2026-02-20
description: Design for driver deduplication using transponder + normalized name
purpose:
  Defines how to identify and merge duplicate Driver records that represent the
  same real-world person, using transponder number and normalized name as the
  matching heuristic. Addresses track leaderboard showing fragmented identities
  (e.g. multiple "Steven Rukavina" rows from different sourceDriverIds).
relatedFiles:
  - docs/database/schema.md
  - docs/architecture/liverc-ingestion/04-data-model.md
  - ingestion/ingestion/normalizer.py
  - ingestion/ingestion/driver_matcher.py
  - src/core/tracks/get-track-leaderboard.ts
---

# Driver Deduplication Design

## Problem Statement

LiveRC assigns a unique `sourceDriverId` per driver account. The same real-world
person can have multiple LiveRC identities (e.g. different accounts, different
tracks, or ingestion quirks), resulting in multiple `Driver` records with
different `sourceDriverId` values but the same or similar display name.

This causes:

1. **Track leaderboard fragmentation**: A driver who races at a track under one
   identity appears on the leaderboard, but the same person racing under a
   different identity creates duplicate or confusing rows (e.g. "Steven
   Rukavina" and "STEVEN RUKAVINA" as separate entries).
2. **Incorrect aggregation**: Points and statistics are split across duplicate
   identities instead of being consolidated per person.
3. **User confusion**: Users expect one row per person per class, not multiple
   rows for the same person.

## Goals

1. **Merge duplicate Driver records** identified by transponder + normalized
   name within the same source (e.g. `liverc`).
2. **Preserve data integrity**: All references (EventEntry, RaceDriver,
   EventDriverLink, etc.) must point to the canonical Driver after merge.
3. **Track leaderboard correctness**: Only drivers who actually raced at the
   selected track appear; points are correctly summed per (driver, class);
   multi-class drivers get one row per class; duplicate identities are
   consolidated.
4. **Idempotent and safe**: Support dry-run, explicit confirmation, and
   reversible audit logging.

## Non-Goals

1. **Cross-source merging**: We do not merge drivers across different sources
   (e.g. liverc + future_connector).
2. **Name-only matching**: We require transponder match when available to avoid
   false positives (e.g. two different people named "John Smith").
3. **Automatic ingestion-time deduplication**: Initial implementation is a batch
   CLI; integration into the ingestion pipeline is a future enhancement.

## Matching Criteria

Two `Driver` records are considered duplicates if:

1. **Same source** (e.g. `source = 'liverc'`).
2. **Same normalized name**: `Normalizer.normalize_driver_name(displayName)`
   matches (case-insensitive, punctuation-stripped, token-sorted).
3. **Same non-null transponder**: `transponder_number` is equal and not
   null/empty.

**Transponder fallback**: If both drivers have null transponder, we do **not**
merge (too risky for false positives). Transponder is the key discriminator.

**EventEntry as transponder source**: `Driver.transponder_number` may be null;
`EventEntry.transponder_number` is the primary source. For matching, we use the
first available of: Driver.transponder_number, or any
EventEntry.transponder_number for that driver (via a subquery/join). If a driver
has no transponder at any level, they are excluded from transponder-based
matching.

## Deduplication Strategy: Full Merge

We perform a **full merge**: one Driver is chosen as canonical; all references
to other Drivers in the duplicate group are updated to point to the canonical
Driver; duplicate Drivers are deleted.

### Canonical Driver Selection

Within each duplicate group, select the canonical Driver by:

1. **Most race results** (RaceResult count via RaceDriver): prefer the Driver
   with the most participation.
2. **Tie-break**: earliest `created_at`.

### Tables Affected and Merge Order

| Table                       | Relation                   | Merge Action                 | Notes                                                                                                                                                                                                                 |
| --------------------------- | -------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `race_drivers`              | driverId → Driver          | UPDATE driverId to canonical | No unique conflict; multiple RaceDrivers can point to same Driver.                                                                                                                                                    |
| `event_entries`             | driverId → Driver          | UPDATE driverId to canonical | May create (eventId, driverId, className) duplicates if same person entered same event+class under different identities. Merge: keep one EventEntry, delete duplicate(s).                                             |
| `multi_main_result_entries` | driverId → Driver          | UPDATE driverId to canonical | May create (multiMainResultId, driverId) duplicates; merge similar to EventEntry.                                                                                                                                     |
| `transponder_overrides`     | driverId → Driver          | UPDATE driverId to canonical | May create (eventId, driverId, effectiveFromRaceId) duplicates; merge by keeping one.                                                                                                                                 |
| `event_driver_links`        | driverId → Driver          | UPDATE driverId to canonical | May create (userId, eventId, driverId) duplicates; merge or delete duplicate links.                                                                                                                                   |
| `user_driver_links`         | driverId → Driver (unique) | UPDATE driverId to canonical | At most one UserDriverLink per Driver. If multiple duplicates had links, keep the canonical Driver's link; reassign others' links if different users (requires conflict resolution—prefer link for canonical's user). |
| `driver_profiles`           | N/A                        | None                         | DriverProfile references User, not Driver.                                                                                                                                                                            |
| `drivers`                   | -                          | DELETE non-canonical         | After all FKs updated.                                                                                                                                                                                                |

**Constraint handling**: Before updating FKs, detect potential unique
violations. For EventEntry: if merging Driver A and B, and both have EventEntry
for (eventId, className), we keep the canonical's entry and delete the other (or
merge car_number/transponder if desired—for simplicity, keep canonical's data).

## Implementation: CLI Command

### Command

```bash
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli drivers deduplicate [OPTIONS]
```

### Options

| Option      | Description                                                                                         |
| ----------- | --------------------------------------------------------------------------------------------------- |
| `--dry-run` | Report duplicate groups and planned merges without writing. Default: True for safety.               |
| `--execute` | Perform the merge. Requires `--dry-run` to be false (i.e. omit `--dry-run` when using `--execute`). |
| `--source`  | Limit to source (default: `liverc`).                                                                |

### Output

- List of duplicate groups: (normalized_name, transponder, driver_ids,
  canonical_id).
- Per group: number of FKs to update per table.
- On `--execute`: summary of merges performed and any errors.

## Safeguards

1. **Dry-run by default**: User must pass `--execute` to perform writes.
2. **Transaction**: Entire merge for one duplicate group in a single
   transaction; rollback on error.
3. **Logging**: Structlog JSON logs for each merge (canonical_id, merged_ids,
   table counts).
4. **Metrics**: Prometheus counters for merges performed, errors.

## Impact on Track Leaderboard

The track leaderboard (`get-track-leaderboard.ts`) aggregates by
`(driverId, className)`. After deduplication:

- Multiple Driver records for the same person become one Driver.
- All RaceResults (via RaceDriver) now point to that one Driver.
- Aggregation naturally produces one row per (person, class) with correctly
  summed points.
- No changes required to the track leaderboard query logic.

### Track Leaderboard Performance (Architecture Decision)

The track leaderboard remains **computed on-demand** from live database tables.
No precomputed or materialized leaderboard table is stored. This keeps the
system simpler and ensures correctness after ingestion, re-ingestion, and driver
deduplication. If performance becomes an issue, the next step is to add caching
(e.g. Redis) with invalidation on event ingestion or driver merge, rather than a
stored leaderboard table.

## Future Enhancements

1. **Ingestion-time hint**: When creating a new Driver from an entry list, check
   for existing Driver with same normalized name + transponder and reuse if
   found.
2. **Name-only merge with manual review**: Optional workflow to suggest merges
   when transponder is null but names match closely (e.g. Jaro-Winkler > 0.95),
   with admin approval.
3. **Driver merge audit table**: Persist merge history for reversibility and
   analytics.
