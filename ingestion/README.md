# LiveRC Ingestion Service

Python microservice for ingesting race data from LiveRC into the MRE database.

## Setup

### Prerequisites

- Python 3.11+
- PostgreSQL database
- Docker (for containerized deployment)

### Installation

1. Create virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Install Playwright browsers:
```bash
playwright install chromium
```

4. Configure environment variables:
```bash
export DATABASE_URL="postgresql://user:password@localhost:5432/mre"
export LOG_LEVEL="INFO"
```

## Development

### Running the API Server

**Docker (Recommended):**
The API server runs automatically when the ingestion service container starts:
```bash
docker compose up -d liverc-ingestion-service
```

The API will be available at `http://localhost:8000` (or your configured port).

**Local (Alternative):**
```bash
python -m ingestion.main
```

Or using uvicorn directly:
```bash
uvicorn ingestion.main:app --host 0.0.0.0 --port 8000
```

### Running CLI Tools

**Docker Execution (Recommended - Primary Method):**

All CLI commands should be run inside the Docker container. This is the recommended and primary method:

```bash
# Ensure ingestion service is running
docker compose up -d liverc-ingestion-service

# List all tracks
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc list-tracks

# Refresh tracks from LiveRC
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc refresh-tracks

# List events for a track
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc list-events --track-id <uuid>

# Refresh events for a track (metadata only)
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc refresh-events --track-id <uuid> --depth none

# Refresh events and perform full ingestion for new events only
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc refresh-events --track-id <uuid> --depth laps_full --ingest-new-only

# Refresh events and perform full ingestion for all events
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc refresh-events --track-id <uuid> --depth laps_full --ingest-all

# Ingest a specific event (legacy command, still supported)
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc ingest-event --event-id <uuid> --depth laps_full

# Check system status
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc status

# Verify data integrity
docker exec -it mre-liverc-ingestion-service python -m ingestion.cli ingest liverc verify-integrity
```

**Why use Docker?**
- No local Python setup required (Python 3.11, dependencies, and Playwright pre-installed)
- Pre-configured database connection via Docker network
- Consistent environment across all developers
- No virtual environment management needed

**Local Execution (Alternative - Requires Python Setup):**

If you prefer to run CLI commands locally without Docker:

```bash
python -m ingestion.cli ingest liverc list-tracks
python -m ingestion.cli ingest liverc ingest-event --event-id <uuid>
```

**Note:** Local execution requires Python 3.11+, virtual environment setup, dependency installation, and Playwright browser installation. See Prerequisites section above.

**Complete CLI Documentation:**
See `docs/operations/liverc-operations-guide.md` for complete CLI command reference, examples, and workflows.

### Running Tests

```bash
pytest
```

## API Endpoints

- `POST /api/v1/tracks/sync` - Sync track catalogue
- `POST /api/v1/events/sync` - Sync events for track
- `POST /api/v1/events/{event_id}/ingest` - Trigger event ingestion
- `GET /api/v1/ingestion/status/{event_id}` - Get ingestion status
- `GET /health` - Health check

## Architecture

See `docs/architecture/liverc-ingestion/` for complete architecture documentation.

## Testing

Tests are organized into:
- `tests/unit/` - Unit tests for individual components
- `tests/integration/` - Integration tests with fixtures
- `tests/fixtures/` - HTML fixtures for testing parsers

### Running Parser Tests

Parser tests use HTML fixtures to ensure deterministic testing:

```bash
# Run all parser tests
pytest tests/unit/test_*_parser.py

# Run specific parser test
pytest tests/unit/test_track_list_parser.py -v

# Run with fixture debugging
pytest tests/unit/test_race_results_parser.py -v -s
```

### Fixture Usage

HTML fixtures are stored in `tests/fixtures/liverc/` and organized by event:

```
tests/fixtures/liverc/
├── track_catalogue.html
├── canberraoffroad_events.html
└── 486677/
    ├── event.html
    ├── race.6304829.html
    ├── race.6304822.html
    ├── race.6304830.html
    ├── metadata.json
    └── notes.md
```

Fixtures enable:
- Offline testing without network access
- Deterministic parser validation
- Regression testing when LiveRC HTML changes
- Debugging parser failures

### Creating New Fixtures

1. Fetch HTML from LiveRC using the fetching script:
   ```bash
   python -m ingestion.scripts.fetch_html_samples --event-detail canberraoffroad 486677
   ```

2. Copy HTML files to fixture directory:
   ```bash
   cp fetched_html.html tests/fixtures/liverc/486677/event.html
   ```

3. Create `metadata.json` with event details:
   ```json
   {
     "event_id": "486677",
     "source": "liverc",
     "fixture_version": 1,
     "tracks": {
       "track_slug": "canberraoffroad",
       "track_name": "Canberra Off Road Model Car Club"
     },
     "races_expected": [6304829, 6304822, 6304830],
     "laps_expected": {
       "346997": 47,
       "298958": 47
     }
   }
   ```

4. Add `notes.md` documenting any quirks or edge cases

### Troubleshooting Parser Failures

#### Parser returns empty results

1. Check if HTML structure changed:
   ```bash
   # Compare fixture HTML with live page
   curl https://live.liverc.com > current_track_catalogue.html
   diff tests/fixtures/liverc/track_catalogue.html current_track_catalogue.html
   ```

2. Verify CSS selectors in `PARSER_SELECTORS.md`

3. Check parser logs for warnings:
   ```bash
   pytest tests/unit/test_track_list_parser.py -v -s --log-cli-level=DEBUG
   ```

#### Driver ID matching fails

- Check if `data-driver-id` attribute exists in results table
- Verify driver name matches `racerLaps` keys (case-insensitive)
- Check logs for "driver_id_matched_by_name" or "result_row_no_driver_id"

#### Race label parsing errors

- Verify race label format matches expected pattern
- Check for races without parentheses (qualifier heats)
- Verify race number extraction regex

#### JavaScript parsing errors

- Check `racerLaps` JavaScript structure hasn't changed
- Verify regex pattern matches actual JavaScript format
- Check for syntax errors in JavaScript object literals

### Parser Selector Reference

See `ingestion/connectors/liverc/PARSER_SELECTORS.md` for complete CSS selector documentation and HTML structure notes.

