# Orchestrate derivation for a single race and return annotations.

from typing import Any

from ingestion.common.logging import get_logger
from ingestion.ingestion.derived_laps.baselines import driver_median_lap_seconds
from ingestion.ingestion.derived_laps.class_thresholds import calculate_class_threshold
from ingestion.ingestion.derived_laps.invalid_laps import compute_invalid_annotations
from ingestion.ingestion.derived_laps.incidents import compute_incident_annotations
from ingestion.ingestion.derived_laps.nitro import (
    is_nitro_class,
    compute_fuel_stop_annotations,
    compute_flame_out_annotations,
)

logger = get_logger(__name__)


def run_derivation_for_race(race_data: dict[str, Any]) -> list[dict]:
    """
    Run all derivation rules for a race and return merged lap annotations.
    
    Args:
        race_data: From repo.get_race_with_results_laps_for_derivation(race_id):
            race: { id, event_id, class_name, duration_seconds }
            results: [ { id, laps_completed, fast_lap_time, avg_lap_time, laps: [ { id, lap_number, lap_time_seconds, elapsed_race_time } ] } ]
            vehicle_type: str | None
    
    Returns:
        List of annotation dicts: race_result_id, lap_number, invalid_reason?, incident_type?, confidence?, metadata?
        One row per (race_result_id, lap_number) with at least one tag; merged if multiple rules fire.
    """
    race = race_data.get("race") or {}
    results = race_data.get("results") or []
    vehicle_type = race_data.get("vehicle_type")
    class_name = race.get("class_name") or ""
    # Class threshold from fast_lap_time of all results in this race
    class_threshold = calculate_class_threshold(
        [{"fast_lap_time": r.get("fast_lap_time")} for r in results]
    )
    laps_completed_by_leader = max((r.get("laps_completed") or 0) for r in results) if results else 0
    nitro = is_nitro_class(vehicle_type, class_name)
    # Merge key: (race_result_id, lap_number) -> annotation dict (last writer wins for overlapping fields)
    merged: dict[tuple[str, int], dict] = {}
    invalid_lap_numbers_by_result: dict[str, set[int]] = {}
    for res in results:
        result_id = res.get("id")
        if not result_id:
            continue
        laps = res.get("laps") or []
        driver_median = driver_median_lap_seconds(laps)
        invalid_lap_numbers_by_result[result_id] = set()
        # 1. Invalid laps (suspected cut)
        for ann in compute_invalid_annotations(result_id, laps, class_threshold, driver_median):
            key = (ann["race_result_id"], ann["lap_number"])
            invalid_lap_numbers_by_result[result_id].add(ann["lap_number"])
            merged[key] = {**ann}
        # 2. Incidents (crash / mechanical)
        for ann in compute_incident_annotations(
            result_id,
            laps,
            driver_median,
            laps_completed_by_leader,
            res.get("laps_completed") or 0,
            invalid_lap_numbers_by_result[result_id],
        ):
            key = (ann["race_result_id"], ann["lap_number"])
            existing = merged.get(key, {"race_result_id": result_id, "lap_number": ann["lap_number"], "invalid_reason": None, "incident_type": None, "confidence": None, "metadata": None})
            existing["incident_type"] = ann["incident_type"]
            existing["confidence"] = ann.get("confidence") or existing.get("confidence")
            if ann.get("metadata"):
                meta = existing.get("metadata") or {}
                if isinstance(meta, dict):
                    meta = dict(meta)
                meta.update(ann["metadata"])
                existing["metadata"] = meta
            merged[key] = existing
        # 3. Nitro: fuel stop and flame out
        if nitro:
            for ann in compute_fuel_stop_annotations(result_id, laps, driver_median):
                key = (ann["race_result_id"], ann["lap_number"])
                existing = merged.get(key, {"race_result_id": result_id, "lap_number": ann["lap_number"], "invalid_reason": None, "incident_type": None, "confidence": None, "metadata": None})
                # Fuel stop takes precedence over incident_type if not set
                if existing.get("incident_type") is None:
                    existing["incident_type"] = ann["incident_type"]
                existing["confidence"] = ann.get("confidence") or existing.get("confidence")
                if ann.get("metadata"):
                    meta = existing.get("metadata") or {}
                    if isinstance(meta, dict):
                        meta = dict(meta)
                    meta.update(ann["metadata"])
                    existing["metadata"] = meta
                merged[key] = existing
            for ann in compute_flame_out_annotations(result_id, laps, driver_median, invalid_lap_numbers_by_result[result_id]):
                key = (ann["race_result_id"], ann["lap_number"])
                existing = merged.get(key, {"race_result_id": result_id, "lap_number": ann["lap_number"], "invalid_reason": None, "incident_type": None, "confidence": None, "metadata": None})
                if existing.get("incident_type") is None:
                    existing["incident_type"] = ann["incident_type"]
                existing["confidence"] = ann.get("confidence") or existing.get("confidence")
                if ann.get("metadata"):
                    meta = existing.get("metadata") or {}
                    if isinstance(meta, dict):
                        meta = dict(meta)
                    meta.update(ann["metadata"])
                    existing["metadata"] = meta
                merged[key] = existing
    out = list(merged.values())
    logger.debug("derivation_complete", race_id=race.get("id"), annotations_count=len(out), nitro=nitro)
    return out
