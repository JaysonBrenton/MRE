"""ClickHouse materialisation must never fail the telemetry parse job."""

from unittest.mock import patch

from ingestion.telemetry.clickhouse_materialise import materialise_gnss_session
from ingestion.telemetry.parsers.csv_gnss import GnssSample


def test_materialise_client_failure_returns_failed_not_raises() -> None:
    """get_client() runs queries during init; auth errors must be contained."""
    samples = [
        GnssSample(
            t_ns=1_000_000_000,
            lat_deg=-35.0,
            lon_deg=149.0,
            alt_m=100.0,
            speed_mps=10.0,
        )
    ]

    def _boom():
        raise RuntimeError("clickhouse auth failed")

    with patch(
        "ingestion.telemetry.clickhouse_materialise._client",
        side_effect=_boom,
    ):
        assert (
            materialise_gnss_session(
                session_id="00000000-0000-0000-0000-000000000001",
                run_id="00000000-0000-0000-0000-000000000002",
                dataset_id="00000000-0000-0000-0000-000000000003",
                samples=samples,
            )
            == "failed"
        )
