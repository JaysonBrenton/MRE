# Speed test: event search vs practice search

Indicative performance comparison between event search/discover and practice search/discover.

## What it measures

| Operation | Path | Purpose |
|-----------|------|---------|
| **Event search** | Next.js → Prisma → PostgreSQL | List events from DB (in-app only). |
| **Practice search** | Next.js → HTTP → Python → PostgreSQL | List ingested practice days (same data shape, via ingestion service). |
| **Event discover** | Next.js → HTTP → Python → LiveRC (1 page) | Fetch event list from LiveRC. |
| **Practice discover** | Next.js → HTTP → Python → LiveRC (1+N pages) | Fetch practice month view + one page per practice day. |

Results are printed with elapsed time for each. The script also prints a simple ratio (e.g. “Practice search vs event search: Xx slower”).

## Prerequisites

- Docker Compose: `app` and `liverc-ingestion-service` running.
- Database with at least one active track.

## Run

From the project root:

```bash
docker exec -it mre-app npx tsx scripts/speed-test-search.ts [trackId]
```

- **trackId** (optional): UUID of the track. If omitted, the first active track is used.
- Optional env (inside the container or when running the script):
  - `TRACK_ID` – same as the `trackId` argument.
  - `START_DATE`, `END_DATE` – ISO date (YYYY-MM-DD) for event search and practice search range.
  - `YEAR`, `MONTH` – for practice discover (default: current year and month).

Examples:

```bash
# Default (first active track, current month)
docker exec -it mre-app npx tsx scripts/speed-test-search.ts

# Specific track
docker exec -it mre-app npx tsx scripts/speed-test-search.ts 2aba913f-eb28-4b11-9f67-e9fdbdf52172

# Custom date range (pass env into container)
docker exec -it -e START_DATE=2025-01-01 -e END_DATE=2025-01-31 -e YEAR=2025 -e MONTH=1 mre-app npx tsx scripts/speed-test-search.ts
```

## Interpreting results

- **Event search** is expected to be fastest (single process, one DB query).
- **Practice search** is expected to be slower than event search for the same “list from DB” workload (extra HTTP hop to Python).
- **Event discover** depends on LiveRC and network (one external page).
- **Practice discover** is expected to be the slowest (many sequential LiveRC requests for the month + each day).

Times are indicative; run multiple times or under different load to gauge variance.
