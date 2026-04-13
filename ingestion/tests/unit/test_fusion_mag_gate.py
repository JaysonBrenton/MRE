"""Mag stability gate + EKF smoke (9-axis path)."""

from ingestion.telemetry.fusion_ekf import evaluate_mag_stability, fuse_gnss_imu_ekf
from ingestion.telemetry.parsers.csv_gnss import GnssSample
from ingestion.telemetry.parsers.fit_imu import ImuSample


def test_mag_gate_rejects_unstable_field():
    imu = []
    t0 = 1_000_000_000_000
    for i in range(20):
        # wildly varying horizontal magnitude
        mx = 20.0 if i % 2 == 0 else 200.0
        imu.append(ImuSample(t_ns=t0 + i * 10_000_000, ax=0, ay=0, az=9.8, gx=0, gy=0, gz=0, mx=mx, my=0.0, mz=0.0))
    ok, meta = evaluate_mag_stability(imu)
    assert ok is False
    assert meta.get("gated") is True


def test_mag_gate_accepts_stable_field():
    imu = []
    t0 = 1_000_000_000_000
    for i in range(20):
        imu.append(
            ImuSample(
                t_ns=t0 + i * 10_000_000,
                ax=0.1,
                ay=0,
                az=9.8,
                gx=0,
                gy=0,
                gz=0,
                mx=25.0,
                my=5.0,
                mz=-10.0,
            )
        )
    ok, meta = evaluate_mag_stability(imu)
    assert ok is True
    assert meta.get("gated") is False


def test_fuse_returns_meta():
    gnss = [
        GnssSample(
            t_ns=1_000_000_000_000 + i * 100_000_000,
            lat_deg=51.0 + i * 1e-6,
            lon_deg=-1.0 + i * 1e-6,
            alt_m=100.0,
            speed_mps=5.0,
        )
        for i in range(5)
    ]
    imu = [
        ImuSample(t_ns=1_000_000_000_000 + i * 50_000_000, ax=0, ay=0, az=9.8, gx=0, gy=0, gz=0, mx=20.0, my=5.0, mz=0.0)
        for i in range(10)
    ]
    out, src, meta = fuse_gnss_imu_ekf(gnss, imu)
    assert src == "ekf_gnss_imu"
    assert len(out) == len(gnss)
    assert "mag_gating" in meta
