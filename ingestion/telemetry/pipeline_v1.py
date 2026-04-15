"""v1 post-parse: downsamples, IMU split, EKF fusion, laps (line/track/auto), segments, ClickHouse."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import text
from sqlalchemy.engine import Connection

from ingestion.telemetry.canonical_parquet import (
    write_accel_parquet,
    write_fused_pose_parquet,
    write_gnss_parquet,
    write_gyro_parquet,
    write_mag_parquet,
)
from ingestion.telemetry.clickhouse_materialise import materialise_gnss_session
from ingestion.telemetry.downsample import downsample_stride, stride_for_target_hz
from ingestion.telemetry.fusion_ekf import (
    FUSION_VERSION_GNSS,
    fuse_gnss_imu_ekf,
)
from ingestion.telemetry.lap_line import detect_laps, version_for_method
from ingestion.telemetry.parsers.csv_gnss import GnssSample
from ingestion.telemetry.quality_v1 import compute_quality_summary
from ingestion.telemetry.segments_corners import detect_segments_corners
from ingestion.telemetry.storage_paths import estimate_hz, resolve_artifact_path


def _ns_to_dt(ns: int) -> datetime:
    return datetime.fromtimestamp(ns / 1e9, tz=timezone.utc)


def _fetch_sfl_context(conn: Connection, session_id: str) -> Tuple[Any, Any]:
    row = (
        conn.execute(
            text(
                """
                SELECT ts.user_sfl_line_geojson AS u,
                       t.start_finish_line_geojson AS t
                FROM telemetry_sessions ts
                LEFT JOIN tracks t ON t.id = ts.track_id
                WHERE ts.id = :sid
                """
            ),
            {"sid": session_id},
        )
        .mappings()
        .one()
    )
    return row["u"], row["t"]


def run_v1_postprocess(
    conn: Connection,
    *,
    session_id: str,
    run_id: str,
    artifact_id: str,
    gnss_dataset_id: str,
    rel_gnss_parquet: str,
    samples: List[GnssSample],
    format_detected: str,
    parser_meta: Dict[str, Any],
) -> Tuple[Dict[str, Any], List[str], str, str]:
    """
    Returns (quality_summary, output_dataset_ids, fusion_version, lap_detector_version).
    """
    user_sfl, track_sfl = _fetch_sfl_context(conn, session_id)

    est_hz = estimate_hz(samples)
    stride10 = stride_for_target_hz(est_hz, 10)
    stride1 = stride_for_target_hz(est_hz, 1)
    ds10 = downsample_stride(samples, stride10)
    ds1 = downsample_stride(samples, stride1)

    base = f"canonical/{session_id}/{run_id}"
    ds10_id = str(uuid.uuid4())
    ds1_id = str(uuid.uuid4())
    fused_id = str(uuid.uuid4())

    rel_ds10 = f"{base}/{ds10_id}/gnss_ds10.parquet"
    rel_ds1 = f"{base}/{ds1_id}/gnss_ds1.parquet"
    rel_fused = f"{base}/{fused_id}/fused_pose.parquet"

    write_gnss_parquet(resolve_artifact_path(rel_ds10), ds10)
    write_gnss_parquet(resolve_artifact_path(rel_ds1), ds1)

    imu_samples: List[Any] = []
    imu_meta: Dict[str, Any] = {}

    fusion_ver = FUSION_VERSION_GNSS
    pose_source = "gnss_only"
    fused_pose_samples: List[GnssSample] = list(samples)
    fusion_meta: Dict[str, Any] = {}

    if imu_samples:
        fused_pose_samples, pose_source, fusion_meta = fuse_gnss_imu_ekf(samples, imu_samples)
        if pose_source == "ekf_gnss_imu":
            fusion_ver = str(fusion_meta.get("fusion_version") or "ekf-2d-ned-0.3.0")
        else:
            fusion_ver = FUSION_VERSION_GNSS

    write_fused_pose_parquet(
        resolve_artifact_path(rel_fused),
        fused_pose_samples,
        pose_source=pose_source,
    )

    lap_samples = fused_pose_samples if pose_source == "ekf_gnss_imu" else samples
    laps, lap_status, lap_method = detect_laps(
        lap_samples,
        user_sfl_geojson=user_sfl,
        track_sfl_geojson=track_sfl,
    )
    lap_detector_ver = version_for_method(lap_method)
    lap_count = len(laps)

    segments = detect_segments_corners(lap_samples)

    quality_block = compute_quality_summary(
        lap_samples,
        estimated_hz=est_hz,
        lap_count=lap_count,
    )

    ch_status = materialise_gnss_session(
        session_id=session_id,
        run_id=run_id,
        dataset_id=gnss_dataset_id,
        samples=samples,
    )

    if ch_status == "ok":
        conn.execute(
            text(
                """
                UPDATE telemetry_datasets
                SET clickhouse_table = 'telemetry_gnss_v1', updated_at = NOW()
                WHERE id = :did
                """
            ),
            {"did": gnss_dataset_id},
        )

    dataset_paths: Dict[str, str] = {
        gnss_dataset_id: rel_gnss_parquet,
        ds10_id: rel_ds10,
        ds1_id: rel_ds1,
        fused_id: rel_fused,
    }
    out_ids: List[str] = [gnss_dataset_id, ds10_id, ds1_id, fused_id]

    art_json = json.dumps([artifact_id])

    conn.execute(
        text(
            """
            INSERT INTO telemetry_datasets (
                id, session_id, run_id, dataset_type, sensor_type,
                imu_dof, imu_channels, frame, axis_convention,
                sample_rate_hz, downsample_factor, clickhouse_table, clickhouse_where_hint,
                schema_version, units_version, created_from_artifact_ids,
                created_at, updated_at
            )
            VALUES (
                :id, :sid, :rid,
                'DOWNSAMPLE_GNSS'::"TelemetryDatasetType",
                'GNSS'::"TelemetryDatasetSensorType",
                NULL, ARRAY[]::TEXT[], NULL, NULL,
                :sr, :dsf, 'not_materialized', NULL,
                1, 1, CAST(:art_ids AS jsonb),
                NOW(), NOW()
            )
            """
        ),
        {"id": ds10_id, "sid": session_id, "rid": run_id, "sr": est_hz, "dsf": stride10, "art_ids": art_json},
    )
    conn.execute(
        text(
            """
            INSERT INTO telemetry_datasets (
                id, session_id, run_id, dataset_type, sensor_type,
                imu_dof, imu_channels, frame, axis_convention,
                sample_rate_hz, downsample_factor, clickhouse_table, clickhouse_where_hint,
                schema_version, units_version, created_from_artifact_ids,
                created_at, updated_at
            )
            VALUES (
                :id, :sid, :rid,
                'DOWNSAMPLE_GNSS'::"TelemetryDatasetType",
                'GNSS'::"TelemetryDatasetSensorType",
                NULL, ARRAY[]::TEXT[], NULL, NULL,
                :sr, :dsf, 'not_materialized', NULL,
                1, 1, CAST(:art_ids AS jsonb),
                NOW(), NOW()
            )
            """
        ),
        {"id": ds1_id, "sid": session_id, "rid": run_id, "sr": est_hz, "dsf": stride1, "art_ids": art_json},
    )
    conn.execute(
        text(
            """
            INSERT INTO telemetry_datasets (
                id, session_id, run_id, dataset_type, sensor_type,
                imu_dof, imu_channels, frame, axis_convention,
                sample_rate_hz, downsample_factor, clickhouse_table, clickhouse_where_hint,
                schema_version, units_version, created_from_artifact_ids,
                created_at, updated_at
            )
            VALUES (
                :id, :sid, :rid,
                'FUSED_POSE'::"TelemetryDatasetType",
                'FUSION'::"TelemetryDatasetSensorType",
                NULL, ARRAY[]::TEXT[], NULL, NULL,
                :sr, NULL, 'not_materialized', NULL,
                1, 1, CAST(:art_ids AS jsonb),
                NOW(), NOW()
            )
            """
        ),
        {"id": fused_id, "sid": session_id, "rid": run_id, "sr": est_hz, "art_ids": art_json},
    )

    if imu_samples:
        has_a = any(s.ax is not None or s.ay is not None or s.az is not None for s in imu_samples)
        has_g = any(s.gx is not None or s.gy is not None or s.gz is not None for s in imu_samples)
        has_m = any(s.mx is not None or s.my is not None or s.mz is not None for s in imu_samples)

        if has_a:
            aid = str(uuid.uuid4())
            rel_a = f"{base}/{aid}/imu_accel.parquet"
            write_accel_parquet(resolve_artifact_path(rel_a), imu_samples)
            dataset_paths[aid] = rel_a
            out_ids.append(aid)
            conn.execute(
                text(
                    """
                    INSERT INTO telemetry_datasets (
                        id, session_id, run_id, dataset_type, sensor_type,
                        imu_dof, imu_channels, frame, axis_convention,
                        sample_rate_hz, downsample_factor, clickhouse_table, clickhouse_where_hint,
                        schema_version, units_version, created_from_artifact_ids,
                        created_at, updated_at
                    )
                    VALUES (
                        :id, :sid, :rid,
                        'CANON_ACCEL'::"TelemetryDatasetType",
                        'IMU'::"TelemetryDatasetSensorType",
                        3, ARRAY['ax','ay','az']::TEXT[], NULL, NULL,
                        :sr, NULL, 'not_materialized', NULL,
                        1, 1, CAST(:art_ids AS jsonb),
                        NOW(), NOW()
                    )
                    """
                ),
                {"id": aid, "sid": session_id, "rid": run_id, "sr": est_hz, "art_ids": art_json},
            )
        if has_g:
            gid = str(uuid.uuid4())
            rel_g = f"{base}/{gid}/imu_gyro.parquet"
            write_gyro_parquet(resolve_artifact_path(rel_g), imu_samples)
            dataset_paths[gid] = rel_g
            out_ids.append(gid)
            conn.execute(
                text(
                    """
                    INSERT INTO telemetry_datasets (
                        id, session_id, run_id, dataset_type, sensor_type,
                        imu_dof, imu_channels, frame, axis_convention,
                        sample_rate_hz, downsample_factor, clickhouse_table, clickhouse_where_hint,
                        schema_version, units_version, created_from_artifact_ids,
                        created_at, updated_at
                    )
                    VALUES (
                        :id, :sid, :rid,
                        'CANON_GYRO'::"TelemetryDatasetType",
                        'IMU'::"TelemetryDatasetSensorType",
                        3, ARRAY['gx','gy','gz']::TEXT[], NULL, NULL,
                        :sr, NULL, 'not_materialized', NULL,
                        1, 1, CAST(:art_ids AS jsonb),
                        NOW(), NOW()
                    )
                    """
                ),
                {"id": gid, "sid": session_id, "rid": run_id, "sr": est_hz, "art_ids": art_json},
            )
        if has_m:
            mid = str(uuid.uuid4())
            rel_m = f"{base}/{mid}/imu_mag.parquet"
            write_mag_parquet(resolve_artifact_path(rel_m), imu_samples)
            dataset_paths[mid] = rel_m
            out_ids.append(mid)
            conn.execute(
                text(
                    """
                    INSERT INTO telemetry_datasets (
                        id, session_id, run_id, dataset_type, sensor_type,
                        imu_dof, imu_channels, frame, axis_convention,
                        sample_rate_hz, downsample_factor, clickhouse_table, clickhouse_where_hint,
                        schema_version, units_version, created_from_artifact_ids,
                        created_at, updated_at
                    )
                    VALUES (
                        :id, :sid, :rid,
                        'CANON_MAG'::"TelemetryDatasetType",
                        'IMU'::"TelemetryDatasetSensorType",
                        3, ARRAY['mx','my','mz']::TEXT[], NULL, NULL,
                        :sr, NULL, 'not_materialized', NULL,
                        1, 1, CAST(:art_ids AS jsonb),
                        NOW(), NOW()
                    )
                    """
                ),
                {"id": mid, "sid": session_id, "rid": run_id, "sr": est_hz, "art_ids": art_json},
            )

    for lap in laps:
        lid = str(uuid.uuid4())
        s_ns = lap_samples[lap.start_idx].t_ns
        e_ns = lap_samples[lap.end_idx].t_ns
        dur_ms = max(0, int((e_ns - s_ns) / 1_000_000))
        conn.execute(
            text(
                """
                INSERT INTO telemetry_laps (
                    id, session_id, run_id, lap_number,
                    start_time_utc, end_time_utc, duration_ms, validity,
                    quality_score, created_at, updated_at
                )
                VALUES (
                    :id, :sid, :rid, :ln,
                    :st, :et, :dm,
                    CAST(:val AS "TelemetryLapValidity"),
                    NULL, NOW(), NOW()
                )
                """
            ),
            {
                "id": lid,
                "sid": session_id,
                "rid": run_id,
                "ln": lap.lap_number,
                "st": _ns_to_dt(s_ns),
                "et": _ns_to_dt(e_ns),
                "dm": dur_ms,
                "val": lap.validity,
            },
        )

    quality_summary: Dict[str, Any] = {
        "parquetRelativePath": rel_gnss_parquet,
        "datasetPaths": dataset_paths,
        "rowCount": len(samples),
        "formatDetected": format_detected,
        "parserMeta": parser_meta,
        "imuMeta": imu_meta,
        "lapDetection": {
            "version": lap_detector_ver,
            "status": lap_status,
            "lapCount": lap_count,
            "method": lap_method,
        },
        "fusion": {
            "version": fusion_ver,
            "poseSource": pose_source,
            "fusedPoseDatasetId": fused_id,
            "magGating": fusion_meta.get("mag_gating") if imu_samples else None,
        },
        "quality": quality_block,
        "segments": segments,
        "materialisation": {
            "clickhouse": ch_status or "skipped",
        },
    }

    return quality_summary, out_ids, fusion_ver, lap_detector_ver


def pipeline_versions() -> Dict[str, str]:
    return {"lap_detector": "auto-sfl-0.1.0", "fusion": "ekf-2d-ned-0.3.0"}
