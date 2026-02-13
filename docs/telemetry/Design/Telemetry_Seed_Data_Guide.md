# Telemetry Seed Data Guide

**Purpose:** Practical guide for creating telemetry seed data sets for testing,
development, and UX validation. Use this as the entry point when you need to
create or extend telemetry fixtures.  
**Audience:** Developers implementing parsers, pipeline, or UI; QA engineers
building test suites.  
**Related:** [Test Strategy and Synthetic Datasets](Test%20Strategy%20and%20Synthetic%20Datasets.md), [Telemetry UX Blueprint](Telemetry_Ux_Blueprint.md), [Supported Formats and Parser Specification](Supported%20Formats%20and%20Parser%20Specification.md)

---

## 1. Purpose and scope

This guide helps you:

- Understand the two purposes for telemetry seed data (testing vs. UX/dev)
- Choose the right approach and format
- Structure fixtures and descriptors
- Get started quickly with minimal duplication of the authoritative specs

For detailed synthetic dataset framework, descriptor schema, and test strategy,
see [Test Strategy and Synthetic Datasets](Test%20Strategy%20and%20Synthetic%20Datasets.md).  
For dummy data requirements and realism targets for UX validation, see [Telemetry
UX Blueprint](Telemetry_Ux_Blueprint.md) Step 5.

---

## 2. Two purposes for seed data

### A. Testing (parsers, pipeline, algorithms)

**Use case:** Automated tests for parsers, fusion, lap detection, segment/corner
detection, quality scoring.

**Requirements:**

- **Synthetic datasets** with **ground truth** for algorithm validation
- **Deterministic generation** (seeded, reproducible)
- Coverage of edge cases (noise, dropout, pit stop, marshal pickup)
- Descriptor JSON with ground truth metadata per dataset

**Authority:** [Test Strategy and Synthetic Datasets](Test%20Strategy%20and%20Synthetic%20Datasets.md) §6–7.

### B. UX / development (UI, flows, manual validation)

**Use case:** Manual development of telemetry UI, UX validation, demo data,
local seeding for dev environments.

**Requirements:**

- **Static dummy datasets** that look realistic
- Representative mix of capability profiles (position-only, 3-axis, 6-axis,
  9-axis)
- Coverage of quality edge cases (clean, noisy, dropout, inconsistent driving)
- Precomputed derived data (laps, segments) for UI if pipeline is not yet run

**Authority:** [Telemetry UX Blueprint](Telemetry_Ux_Blueprint.md) Step 5,
[Exploring the End User Experience](../End_User_Experience/Exploring_the_End_User_Experience_for_Telemetry_in_MRE.md) Step 5.

---

## 3. Quick-start options

### Option A: Static CSV fixtures (fastest)

Create a few CSV files manually or via a simple script. Include columns such as:
`timestamp_ms`, `lat`, `lon`, `speed_mps`, optionally `ax`, `ay`, `az`, `gx`,
`gy`, `gz`, and quality fields.

**Best for:** Parser smoke tests, initial UI wiring, quick iteration.

**Storage:** `ingestion/tests/fixtures/telemetry/` with a `metadata.json` per
dataset.

### Option B: Generator + seed (deterministic, scalable)

Implement a small Python or TypeScript generator that:

1. Produces track centreline (e.g. parametric oval or template)
2. Simulates vehicle path along it with variable lap times
3. Samples GNSS (and optionally IMU) with configurable noise
4. Writes CSV or GPX with deterministic seed
5. Outputs a descriptor JSON with ground truth

**Best for:** Automated tests, regression, CI, Pack A/B generation.

**Authority:** [Test Strategy and Synthetic Datasets](Test%20Strategy%20and%20Synthetic%20Datasets.md) §6.

### Option C: Hybrid

- Use Option A for rapid UX and manual testing.
- Add Option B incrementally for automated tests and regression once parsers
  exist.

---

## 4. Storage layout

Follow the existing ingestion fixture pattern (see `ingestion/tests/fixtures/liverc/`):

```
ingestion/tests/fixtures/telemetry/
  track-templates/           # KML racing lines (polygon = path)
    cormcc.kml
  synth/
    pack-a/
      cormcc-clean-position-only/
        session.csv
        metadata.json
      ...
  dummy/                     # UX/dev seed data (static or preprocessed)
    ...
```

**metadata.json** should include:

- `fixture_version`
- `dataset_id`, `seed` (for synthetic)
- `capability_profile`, `laps_expected`
- `ground_truth` (for tests)
- `notes` for maintainers

See [Test Strategy and Synthetic Datasets](Test%20Strategy%20and%20Synthetic%20Datasets.md) §6.3 for the full descriptor schema.

---

## 5. Input formats

Parsers are expected to support ([Supported Formats](Supported%20Formats%20and%20Parser%20Specification.md) §5):

- **CSV/TSV**
- **GPX**
- **NMEA 0183**
- **JSON**

Start with **CSV** and **GPX** for fastest adoption.

---

## 6. Required dummy sessions (UX)

From [Telemetry UX Blueprint](Telemetry_Ux_Blueprint.md) Step 5, ensure these
session types exist for UX validation:

| Session type           | Capability   | Purpose                      |
| ---------------------- | ------------ | ---------------------------- |
| Clean session          | 9-axis       | Best-case baseline           |
| Clean session          | Position only| Minimal data handling        |
| Noisy GNSS             | 6-axis       | Quality indicators           |
| GNSS dropouts          | 6-axis       | Missing data handling        |
| Jump-heavy             | 6-axis       | Jump/impact events           |
| Inconsistent driving   | Position/3-axis | Consistency views         |

**Realism targets:** 8–12 laps, 8–12 minutes, best lap and near-best lap, 1–2
obvious mistakes, time loss concentrated in 2–4 segments.

---

## 7. Pack structure (testing)

From [Test Strategy and Synthetic Datasets](Test%20Strategy%20and%20Synthetic%20Datasets.md) §6.4:

- **Pack A (smoke):** ~5 datasets, small (S class), clean + noisy + dropout +
  pit + marshal pickup
- **Pack B (nightly):** ~20 datasets, S and M classes, fused profiles,
  multi-stint, multi-file
- **Pack C (perf):** larger M/L for benchmarking

---

## 8. Implementation order

1. ~~Define at least one track template~~ — Cormcc KML in `track-templates/cormcc.kml`
2. ~~Implement minimal generator~~ — `ingestion/scripts/generate-telemetry-seed.py`
3. ~~Add CSV export writer~~ — Done
4. Generate Pack A (expand to 5 datasets: clean, noisy, dropout, etc.)
5. Add descriptor JSON with ground truth — Done for cormcc-clean-position-only
6. Create UX dummy pack (generated or hand-crafted)
7. Integrate with test harness and/or seed script

### Running the generator

From repo root, inside the ingestion container:

```bash
docker exec -it mre-liverc-ingestion-service python /app/ingestion/scripts/generate-telemetry-seed.py \
  --track /app/ingestion/tests/fixtures/telemetry/track-templates/cormcc.kml \
  --output /app/ingestion/tests/fixtures/telemetry/synth/pack-a/cormcc-clean-position-only \
  --laps 10 --seed 42
```

Or locally (if Python is available):

```bash
python ingestion/scripts/generate-telemetry-seed.py \
  --track ingestion/tests/fixtures/telemetry/track-templates/cormcc.kml \
  --output ingestion/tests/fixtures/telemetry/synth/pack-a/cormcc-clean-position-only \
  --laps 10 --seed 42
```

---

## 9. Privacy and governance

- Use **synthetic or anonymised** data only; never real user telemetry in the
  repo
- Version and checksum dataset packs
- See [Test Strategy and Synthetic Datasets](Test%20Strategy%20and%20Synthetic%20Datasets.md) §11.2, §14

---

## 10. Appendix: Minimal descriptor example

```json
{
  "fixture_version": 1,
  "source": "synthetic",
  "dataset_id": "clean-9axis-01",
  "seed": 42,
  "laps_expected": 10,
  "capability_profile": "9-axis",
  "ground_truth": {
    "lap_times_true": [42100, 41900, 42050],
    "sfl_points": []
  },
  "notes": "Clean session, ideal for smoke tests."
}
```

Full descriptor schema: [Test Strategy and Synthetic Datasets](Test%20Strategy%20and%20Synthetic%20Datasets.md) §6.3.
