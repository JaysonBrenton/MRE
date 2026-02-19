# Telemetry Fixtures

Synthetic and dummy telemetry seed data for testing, development, and UX validation.

## Structure

- **track-templates/** — KML files (polygon boundary = racing line). Used by the generator.
- **synth/** — Synthetically generated datasets (Pack A, B, C per Test Strategy).
- **dummy/** — Static dummy data for UX/dev (when added).

## Generating fixtures

Use the generator script with a track template:

```bash
docker exec -it mre-liverc-ingestion-service python /app/ingestion/scripts/generate-telemetry-seed.py \
  --track /app/ingestion/tests/fixtures/telemetry/track-templates/cormcc.kml \
  --output /app/ingestion/tests/fixtures/telemetry/synth/pack-a/cormcc-clean-position-only \
  --laps 10 --seed 42
```

See `docs/telemetry/Design/Telemetry_Seed_Data_Guide.md` for full usage and options.

## Current fixtures

### MVP parser fixtures (required for Phase 3 tests)

| File                   | Purpose |
| ---------------------- | ------- |
| sample_gnss_10hz.csv  | Valid 10 Hz GNSS CSV (timestamp_ms, lat, lon, alt_m, speed_mps). Parser must produce gnss_pvt. |
| sample_track.gpx       | Valid GPX track with trkpt, ele, time. Parser must produce gnss_pvt. |
| csv_no_time.csv        | CSV with lat, lon, speed_mps but no time column. Parser must emit error code CSV_NO_TIME_COLUMN. |

See [Telemetry MVP Implementation Decisions](../../../../docs/telemetry/Design/Telemetry_MVP_Implementation_Decisions.md) §5.

### Synthetic / generator output

| Dataset                    | Capability   | Laps | Notes                    |
| -------------------------- | ------------ | ---- | ------------------------ |
| cormcc-clean-position-only | position-only| 10   | Cormcc track, smoke test |
