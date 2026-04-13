"""u-blox UBX NAV-PVT (0x01 0x07) GNSS parser (minimal)."""

from __future__ import annotations

from typing import Any, Dict, List, Tuple

from ingestion.telemetry.errors import TelemetryParseError
from ingestion.telemetry.parsers.csv_gnss import GnssSample


def _u16(b: bytes, o: int) -> int:
    return int.from_bytes(b[o : o + 2], "little", signed=False)


def _i32(b: bytes, o: int) -> int:
    return int.from_bytes(b[o : o + 4], "little", signed=True)


def _ubx_checksum(body: bytes) -> Tuple[int, int]:
    ck_a = 0
    ck_b = 0
    for byte in body:
        ck_a = (ck_a + byte) & 0xFF
        ck_b = (ck_b + ck_a) & 0xFF
    return ck_a, ck_b


def parse_ubx_gnss(raw_bytes: bytes) -> Tuple[List[GnssSample], Dict[str, Any]]:
    if len(raw_bytes) < 10:
        raise TelemetryParseError("UBX_EMPTY", "UBX file is empty or too small")

    out: List[GnssSample] = []
    i = 0
    while i + 6 < len(raw_bytes):
        if raw_bytes[i] != 0xB5 or raw_bytes[i + 1] != 0x62:
            i += 1
            continue
        msg_class = raw_bytes[i + 2]
        msg_id = raw_bytes[i + 3]
        length = _u16(raw_bytes, i + 4)
        end = i + 6 + length + 2
        if end > len(raw_bytes):
            break
        payload = raw_bytes[i + 6 : i + 6 + length]
        ck_a, ck_b = raw_bytes[i + 6 + length], raw_bytes[i + 6 + length + 1]
        body = bytes([msg_class, msg_id, length & 0xFF, (length >> 8) & 0xFF]) + payload
        e_a, e_b = _ubx_checksum(body)
        if ck_a != e_a or ck_b != e_b:
            i += 2
            continue
        if msg_class == 0x01 and msg_id == 0x07 and length >= 92:
            # NAV-PVT
            fix = payload[20] if len(payload) > 20 else 0
            if fix < 2:
                i = end
                continue
            lon_deg = _i32(payload, 24) * 1e-7
            lat_deg = _i32(payload, 28) * 1e-7
            hmsl_m = _i32(payload, 36) / 1000.0 if len(payload) > 39 else None
            g_speed = (
                int.from_bytes(payload[60:64], "little", signed=False) / 1000.0 if len(payload) > 63 else None
            )
            nano = _i32(payload, 16) if len(payload) > 19 else 0
            itow_ms = int.from_bytes(payload[0:4], "little", signed=False) if len(payload) > 3 else 0
            t_ns = int(itow_ms) * 1_000_000 + int(nano)
            if abs(lat_deg) < 1e-6 and abs(lon_deg) < 1e-6:
                i = end
                continue
            spd = float(g_speed) if g_speed is not None else None
            out.append(
                GnssSample(
                    t_ns=t_ns,
                    lat_deg=float(lat_deg),
                    lon_deg=float(lon_deg),
                    alt_m=float(hmsl_m) if hmsl_m is not None else None,
                    speed_mps=spd,
                )
            )
        i = end

    if not out:
        raise TelemetryParseError("UBX_NO_FIX", "No valid NAV-PVT fixes in UBX stream")

    out.sort(key=lambda s: s.t_ns)
    meta = {"format": "ubx_nav_pvt", "rowCount": len(out)}
    return out, meta


def looks_like_ubx(raw: bytes) -> bool:
    if len(raw) < 100:
        return False
    hits = 0
    i = 0
    while i + 2 < min(len(raw), 4096):
        if raw[i] == 0xB5 and raw[i + 1] == 0x62:
            hits += 1
            i += 2
        else:
            i += 1
    return hits >= 3
