# Telemetry Fixtures

Synthetic and dummy telemetry seed data for testing, development, and UX
validation.

## Structure

- **track-templates/** — KML files (polygon boundary = racing line). Used by the
  generator.
- **synth/** — Synthetically generated datasets (Pack A, B, C per Test
  Strategy).
- **dummy/** — Static dummy data for UX/dev (when added).

## Generating fixtures

Use the generator script with a track template:

```bash
docker exec -it mre-liverc-ingestion-service python /app/ingestion/scripts/generate-telemetry-seed.py \
  --track /app/ingestion/tests/fixtures/telemetry/track-templates/cormcc.kml \
  --output /app/ingestion/tests/fixtures/telemetry/synth/pack-a/cormcc-clean-position-only \
  --laps 10 --seed 42
```

See `docs/telemetry/Design/Telemetry_Seed_Data_Guide.md` for full usage and
options.

## Current fixtures

### MVP parser fixtures (required for Phase 3 tests)

| File                     | Purpose                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------ |
| sample_gnss_10hz.csv     | Valid 10 Hz GNSS CSV (timestamp_ms, lat, lon, alt_m, speed_mps). Parser must produce gnss_pvt.   |
| sample_track.gpx         | Valid GPX track with trkpt, ele, time. Parser must produce gnss_pvt.                             |
| csv_no_time.csv          | CSV with lat, lon, speed_mps but no time column. Parser must emit error code CSV_NO_TIME_COLUMN. |
| sample_gnss.json         | Valid JSON array (timestamp_ms, lat, lon, alt_m, speed_mps). Parser must produce gnss_pvt.       |
| sample_nmea_rmc_gga.nmea | NMEA RMC+GGA; parser produces gnss_pvt (see Phase 3a tests).                                     |

**End-to-end expectation for `csv_no_time.csv`:** the worker fails `parse_raw`
with `CSV_NO_TIME_COLUMN`; the session ends **`failed`**, there is **no**
`telemetry_datasets` row and **no** canonical Parquet, so the UI correctly shows
**no GNSS dataset** and **no path preview** (not a bug). The session detail API
should include **`failure: { code, message }`**.

See
[Telemetry MVP Implementation Decisions](../../../../docs/telemetry/Design/Telemetry_MVP_Implementation_Decisions.md)
§5.

### Multi-lap full-channel synthetic (upload / parser testing)

Folder **`multi-lap-full/`** — 5 laps at 10 Hz on `track-templates/cormcc.kml`:
`session_full.csv`, `session_full.json`, `session_full.gpx`,
`session_full_1hz.nmea`, plus `metadata.json` with ground-truth lap times.
Regenerate:
`python /app/ingestion/scripts/build_multi_lap_full_telemetry_fixtures.py`
(ingestion container).

### F1 circuit line fixtures (manual / UX testing)

Folder **`f1-circuits/`** — CSV + GPX built from
[bacinger/f1-circuits](https://github.com/bacinger/f1-circuits) GeoJSON (MIT),
with synthetic 10 Hz timestamps. These are **track polylines**, not race
telemetry. Regenerate:
`python ingestion/scripts/build_f1_telemetry_fixtures.py`.

| Files                                      | Circuit           |
| ------------------------------------------ | ----------------- |
| `f1_monaco.csv`, `f1_monaco.gpx`           | Monaco            |
| `f1_silverstone.csv`, `f1_silverstone.gpx` | Silverstone       |
| `f1_spa.csv`, `f1_spa.gpx`                 | Spa-Francorchamps |
| `f1_suzuka.csv`, `f1_suzuka.gpx`           | Suzuka            |

### Synthetic / generator output

| Dataset                    | Capability    | Laps | Notes                    |
| -------------------------- | ------------- | ---- | ------------------------ |
| cormcc-clean-position-only | position-only | 10   | Cormcc track, smoke test |
