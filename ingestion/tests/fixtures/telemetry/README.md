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

| Dataset                    | Capability   | Laps | Notes                    |
| -------------------------- | ------------ | ---- | ------------------------ |
| cormcc-clean-position-only | position-only| 10   | Cormcc track, smoke test |
