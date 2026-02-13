# Track Templates (KML)

KML files defining racing lines for telemetry seed data generation. The polygon
boundary in each KML is treated as the **racing line** (path the vehicle
follows), not the track boundary.

## Format

- **Geometry:** Polygon with outer boundary (LinearRing)
- **Coordinates:** lon,lat,altitude (KML standard)
- **Source:** Typically traced in Google Earth as the best racing line

## Usage

Pass the KML path to the generator:

```bash
docker exec -it mre-liverc-ingestion-service python /app/ingestion/scripts/generate-telemetry-seed.py \
  --track /app/ingestion/tests/fixtures/telemetry/track-templates/cormcc.kml \
  --output /app/ingestion/tests/fixtures/telemetry/synth/pack-a/<dataset-name> \
  --laps 10 --seed 42
```

## Current templates

| File      | Track   | Notes                            |
| --------- | ------- | -------------------------------- |
| cormcc.kml| Cormcc  | Canberra Off Road Model Car Club |

## Adding new templates

1. Create the racing line in Google Earth (trace the best line)
2. Export as KML (polygon or path; polygon outer boundary is used)
3. Place the file here
4. Update this README
5. Generate fixtures with the generator script

See `docs/telemetry/Design/Telemetry_Seed_Data_Guide.md` for full guidance.
