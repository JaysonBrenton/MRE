"""Parse WGS84 GeoJSON LineString into a single start/finish segment (first two coordinates)."""

from __future__ import annotations

from typing import Any, Dict, Optional, Tuple


def parse_sfl_segment_from_geojson(obj: Any) -> Optional[Tuple[Tuple[float, float], Tuple[float, float]]]:
    """
    Returns ((lat1, lon1), (lat2, lon2)) for the SFL segment, or None.
    GeoJSON uses [lon, lat] order.
    """
    if obj is None:
        return None
    if isinstance(obj, str):
        import json

        try:
            obj = json.loads(obj)
        except json.JSONDecodeError:
            return None
    if not isinstance(obj, dict):
        return None
    geom = obj.get("geometry") if obj.get("type") == "Feature" else obj
    if not isinstance(geom, dict):
        return None
    if geom.get("type") != "LineString":
        return None
    coords = geom.get("coordinates")
    if not isinstance(coords, list) or len(coords) < 2:
        return None
    a, b = coords[0], coords[1]
    if not (isinstance(a, (list, tuple)) and isinstance(b, (list, tuple)) and len(a) >= 2 and len(b) >= 2):
        return None
    lon1, lat1 = float(a[0]), float(a[1])
    lon2, lat2 = float(b[0]), float(b[1])
    return (lat1, lon1), (lat2, lon2)


def geojson_dict_from_segment(lat1: float, lon1: float, lat2: float, lon2: float) -> Dict[str, Any]:
    return {
        "type": "LineString",
        "coordinates": [[lon1, lat1], [lon2, lat2]],
    }
