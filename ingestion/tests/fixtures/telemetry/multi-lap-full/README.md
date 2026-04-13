# Multi-lap full-channel synthetic session

Deterministic **5-lap** session on `track-templates/cormcc.kml` at **10 Hz**
(seed `42`).

| File                    | Contents                                                                                                                                                                                                        |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `session_full.csv`      | GNSS columns (`timestamp_ms`, `lat`, `lon`, `alt_m`, `speed_mps`) plus synthetic **heading**, **accel**, **gyro**, `hdop`, `fix_quality`. The worker’s CSV parser ingests GNSS only; extra columns are ignored. |
| `session_full.json`     | Same samples as a JSON array (GNSS + extra fields).                                                                                                                                                             |
| `session_full.gpx`      | GPX 1.1 track; times = `session_start_utc` from `metadata.json` + `timestamp_ms`.                                                                                                                               |
| `session_full_1hz.nmea` | `GPRMC` + `GPGGA` at **1 Hz** (pairs every 10th 10 Hz sample). The NMEA parser merges by whole seconds, so higher-rate NMEA would collapse samples.                                                             |
| `metadata.json`         | Ground-truth **lap_times_ms**, **lap_boundaries_sample_idx**, track length.                                                                                                                                     |

Regenerate (from repo root, ingestion container):

```bash
docker exec -it mre-liverc-ingestion-service python \
  /app/ingestion/scripts/build_multi_lap_full_telemetry_fixtures.py
```

For **IMU inside FIT** as ingested by the worker, use `sample_activity.fit` or
another FIT with accel/gyro records; this bundle exposes IMU as **CSV/JSON
sidecar-style** columns for tests and analysis.
