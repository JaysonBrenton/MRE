# F1 circuit line fixtures (synthetic timing)

These files are **not** official F1 telemetry. They are **centre-line
polylines** from
[github.com/bacinger/f1-circuits](https://github.com/bacinger/f1-circuits) (MIT
License), converted to CSV and GPX with **synthetic** 10 Hz timestamps for
**import testing** only.

| File               | Circuit           |
| ------------------ | ----------------- |
| `f1_monaco_*`      | Circuit de Monaco |
| `f1_silverstone_*` | Silverstone       |
| `f1_spa_*`         | Spa-Francorchamps |
| `f1_suzuka_*`      | Suzuka            |

Regenerate: `python ingestion/scripts/build_f1_telemetry_fixtures.py` (Docker:
run inside `mre-liverc-ingestion-service`).
