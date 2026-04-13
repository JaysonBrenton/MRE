"""
2D loosely-coupled GNSS + IMU EKF in local ENU metres (flat-earth near first fix).

Optional weak magnetometer heading blend when horizontal field is stable (mag gating).
Falls back to GNSS-only if IMU is missing or the filter is ill-conditioned.
"""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from ingestion.telemetry.parsers.csv_gnss import GnssSample
from ingestion.telemetry.parsers.fit_imu import ImuSample


def _ll_to_xy(lat_deg: float, lon_deg: float, lat0: float, lon0: float) -> Tuple[float, float]:
    r = 6371000.0
    x = r * np.radians(lon_deg - lon0) * np.cos(np.radians(lat0))
    y = r * np.radians(lat_deg - lat0)
    return float(x), float(y)


def _xy_to_ll(x: float, y: float, lat0: float, lon0: float) -> Tuple[float, float]:
    r = 6371000.0
    lat = lat0 + np.degrees(y / r)
    lon = lon0 + np.degrees(x / (r * np.cos(np.radians(lat0))))
    return float(lat), float(lon)


def _interp_imu(imu: List[ImuSample], t_ns: int) -> Tuple[float, float, float, float, float, float]:
    """Linear interpolation of IMU channels at t_ns."""
    if not imu:
        return 0.0, 0.0, 0.0, 0.0, 0.0, 0.0
    ts = np.array([s.t_ns for s in imu], dtype=np.float64)
    if t_ns <= ts[0]:
        s = imu[0]
        return (
            float(s.ax or 0.0),
            float(s.ay or 0.0),
            float(s.az or 0.0),
            float(s.gx or 0.0),
            float(s.gy or 0.0),
            float(s.gz or 0.0),
        )
    if t_ns >= ts[-1]:
        s = imu[-1]
        return (
            float(s.ax or 0.0),
            float(s.ay or 0.0),
            float(s.az or 0.0),
            float(s.gx or 0.0),
            float(s.gy or 0.0),
            float(s.gz or 0.0),
        )
    idx = int(np.searchsorted(ts, t_ns, side="right") - 1)
    idx = max(0, min(idx, len(imu) - 2))
    s0, s1 = imu[idx], imu[idx + 1]
    t0, t1 = float(s0.t_ns), float(s1.t_ns)
    w = (t_ns - t0) / (t1 - t0) if t1 > t0 else 0.0

    def l(a0: Optional[float], a1: Optional[float]) -> float:
        v0 = float(a0 or 0.0)
        v1 = float(a1 or 0.0)
        return v0 + w * (v1 - v0)

    return (
        l(s0.ax, s1.ax),
        l(s0.ay, s1.ay),
        l(s0.az, s1.az),
        l(s0.gx, s1.gx),
        l(s0.gy, s1.gy),
        l(s0.gz, s1.gz),
    )


def _interp_imu_full(
    imu: List[ImuSample], t_ns: int
) -> Tuple[float, float, float, float, float, float, Optional[float], Optional[float], Optional[float]]:
    """Linear interpolation of accel, gyro, mag at t_ns."""
    if not imu:
        return 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, None, None, None
    ts = np.array([s.t_ns for s in imu], dtype=np.float64)
    if t_ns <= ts[0]:
        s = imu[0]
        return (
            float(s.ax or 0.0),
            float(s.ay or 0.0),
            float(s.az or 0.0),
            float(s.gx or 0.0),
            float(s.gy or 0.0),
            float(s.gz or 0.0),
            float(s.mx) if s.mx is not None else None,
            float(s.my) if s.my is not None else None,
            float(s.mz) if s.mz is not None else None,
        )
    if t_ns >= ts[-1]:
        s = imu[-1]
        return (
            float(s.ax or 0.0),
            float(s.ay or 0.0),
            float(s.az or 0.0),
            float(s.gx or 0.0),
            float(s.gy or 0.0),
            float(s.gz or 0.0),
            float(s.mx) if s.mx is not None else None,
            float(s.my) if s.my is not None else None,
            float(s.mz) if s.mz is not None else None,
        )
    idx = int(np.searchsorted(ts, t_ns, side="right") - 1)
    idx = max(0, min(idx, len(imu) - 2))
    s0, s1 = imu[idx], imu[idx + 1]
    t0, t1 = float(s0.t_ns), float(s1.t_ns)
    w = (t_ns - t0) / (t1 - t0) if t1 > t0 else 0.0

    def l(a0: Optional[float], a1: Optional[float]) -> float:
        v0 = float(a0 or 0.0)
        v1 = float(a1 or 0.0)
        return v0 + w * (v1 - v0)

    def l_opt(a0: Optional[float], a1: Optional[float]) -> Optional[float]:
        if a0 is None and a1 is None:
            return None
        return l(a0, a1)

    return (
        l(s0.ax, s1.ax),
        l(s0.ay, s1.ay),
        l(s0.az, s1.az),
        l(s0.gx, s1.gx),
        l(s0.gy, s1.gy),
        l(s0.gz, s1.gz),
        l_opt(s0.mx, s1.mx),
        l_opt(s0.my, s1.my),
        l_opt(s0.mz, s1.mz),
    )


def evaluate_mag_stability(imu: List[ImuSample]) -> Tuple[bool, Dict[str, Any]]:
    """
    Returns (use_mag_heading, meta). Gated (use_mag_heading=False) when field is unstable or absent.
    """
    horiz: List[float] = []
    for s in imu:
        if s.mx is not None and s.my is not None:
            horiz.append(math.hypot(float(s.mx), float(s.my)))
    if len(horiz) < 12:
        return False, {"reason": "insufficient_mag_samples", "gated": True}
    mean = float(np.mean(horiz))
    if mean < 1e-5:
        return False, {"reason": "weak_field", "gated": True, "mean": mean}
    cv = float(np.std(horiz) / mean)
    gated = cv > 0.45
    return (not gated), {"gated": gated, "cv": cv, "mean": mean, "samples": len(horiz)}


FUSION_VERSION_EKF = "ekf-2d-ned-0.3.0"
FUSION_VERSION_EKF_MAG = "ekf-2d-ned-0.3.0-mag"
FUSION_VERSION_GNSS = "gnss-only-0.3.0"


def fuse_gnss_imu_ekf(
    gnss: List[GnssSample],
    imu: List[ImuSample],
) -> Tuple[List[GnssSample], str, Dict[str, Any]]:
    """
    Returns fused GNSS samples (lat/lon updated), pose_source label, meta dict.
    """
    if len(gnss) < 3 or not imu:
        return list(gnss), "gnss_only", {"reason": "no_imu_or_short_gnss", "mag_gating": {"used": False}}

    mag_ok, mag_meta = evaluate_mag_stability(imu)
    used_mag_psi = False

    lat0 = gnss[0].lat_deg
    lon0 = gnss[0].lon_deg
    xy = np.array([_ll_to_xy(s.lat_deg, s.lon_deg, lat0, lon0) for s in gnss], dtype=np.float64)

    n = len(gnss)
    x = np.zeros(4, dtype=np.float64)
    x[0], x[1] = xy[0, 0], xy[0, 1]
    if n > 1:
        dt0 = max(1e-6, (gnss[1].t_ns - gnss[0].t_ns) / 1e9)
        x[2] = (xy[1, 0] - xy[0, 0]) / dt0
        x[3] = (xy[1, 1] - xy[0, 1]) / dt0

    p = np.eye(4, dtype=np.float64) * 25.0
    r_meas = np.diag([4.0**2, 4.0**2])
    q_scale = 0.5

    h = np.array([[1.0, 0.0, 0.0, 0.0], [0.0, 1.0, 0.0, 0.0]], dtype=np.float64)

    out_xy = np.zeros_like(xy)
    out_xy[0] = xy[0]

    try:
        for k in range(1, n):
            t_prev, t_k = gnss[k - 1].t_ns, gnss[k].t_ns
            dt = max(1e-4, (t_k - t_prev) / 1e9)
            t_mid = (t_prev + t_k) // 2
            ax, ay, _, _, _, _, mx, my, _mz = _interp_imu_full(imu, t_mid)

            dxi = xy[k, 0] - xy[k - 1, 0]
            dyi = xy[k, 1] - xy[k - 1, 1]
            psi_path = float(np.arctan2(dyi, dxi)) if (dxi * dxi + dyi * dyi) > 1.0 else float(
                np.arctan2(x[3], x[2])
            )
            spd = gnss[k].speed_mps
            spd_f = float(spd) if spd is not None else 999.0
            psi_mag: Optional[float] = None
            if mx is not None and my is not None:
                psi_mag = math.atan2(-my, mx)
            use_mag = (
                mag_ok
                and psi_mag is not None
                and spd_f < 12.0
                and (dxi * dxi + dyi * dyi) <= 25.0
            )
            alpha = 0.22 if use_mag else 0.0
            if use_mag and psi_mag is not None:
                psi = (1.0 - alpha) * psi_path + alpha * psi_mag
                used_mag_psi = True
            else:
                psi = psi_path

            a_n = ax * np.cos(psi) - ay * np.sin(psi)
            a_e = ax * np.sin(psi) + ay * np.cos(psi)

            x_pred = np.array(
                [
                    x[0] + x[2] * dt + 0.5 * a_n * dt * dt,
                    x[1] + x[3] * dt + 0.5 * a_e * dt * dt,
                    x[2] + a_n * dt,
                    x[3] + a_e * dt,
                ],
                dtype=np.float64,
            )

            f_j = np.array(
                [
                    [1.0, 0.0, dt, 0.0],
                    [0.0, 1.0, 0.0, dt],
                    [0.0, 0.0, 1.0, 0.0],
                    [0.0, 0.0, 0.0, 1.0],
                ],
                dtype=np.float64,
            )
            q = np.eye(4, dtype=np.float64) * (q_scale * dt**2)
            p_pred = f_j @ p @ f_j.T + q

            z = np.array([xy[k, 0], xy[k, 1]], dtype=np.float64)
            y_innov = z - h @ x_pred
            s = h @ p_pred @ h.T + r_meas
            s_inv = np.linalg.inv(s)
            k_gain = p_pred @ h.T @ s_inv
            x = x_pred + k_gain @ y_innov
            p = (np.eye(4) - k_gain @ h) @ p_pred
            out_xy[k] = [x[0], x[1]]

        fused: List[GnssSample] = []
        for i, s in enumerate(gnss):
            lat, lon = _xy_to_ll(out_xy[i, 0], out_xy[i, 1], lat0, lon0)
            fused.append(
                GnssSample(
                    t_ns=s.t_ns,
                    lat_deg=lat,
                    lon_deg=lon,
                    alt_m=s.alt_m,
                    speed_mps=s.speed_mps,
                )
            )
        meta: Dict[str, Any] = {
            "states": 4,
            "points": n,
            "mag_gating": {
                **mag_meta,
                "used": used_mag_psi,
                "heading_blend": used_mag_psi,
            },
            "fusion_version": FUSION_VERSION_EKF_MAG if used_mag_psi else FUSION_VERSION_EKF,
        }
        return fused, "ekf_gnss_imu", meta
    except (np.linalg.LinAlgError, FloatingPointError, ValueError):
        return list(gnss), "gnss_only", {"reason": "ekf_failed", "mag_gating": {"gated": True}}
