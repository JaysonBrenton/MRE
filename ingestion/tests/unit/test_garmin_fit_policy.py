"""Garmin FIT uploads are rejected before parsing."""

from ingestion.telemetry.garmin_fit_policy import is_garmin_fit_file


def test_fit_extension_flags() -> None:
    assert is_garmin_fit_file(b"not-fit-data", "session.fit") is True
    assert is_garmin_fit_file(b"not-fit-data", "SESSION.FIT") is True


def test_fit_magic_bytes_flags() -> None:
    buf = b"\x00" * 8 + b".FIT" + b"\x00" * 20
    assert is_garmin_fit_file(buf, "unknown.bin") is True


def test_normal_csv_not_fit() -> None:
    assert is_garmin_fit_file(b"lat,lon,time\n", "export.csv") is False
