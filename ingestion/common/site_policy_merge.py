"""Merge base site policy JSON with DB/runtime overrides."""

from __future__ import annotations

from copy import deepcopy
from typing import Any, Dict, List


def _merge_host_rules(base_hosts: List[Dict[str, Any]], override_hosts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    by_pattern: Dict[str, Dict[str, Any]] = {}
    order: List[str] = []

    for host in base_hosts:
        pattern = host.get("pattern")
        if not isinstance(pattern, str) or not pattern:
            continue
        by_pattern[pattern] = deepcopy(host)
        order.append(pattern)

    for override in override_hosts:
        if not isinstance(override, dict):
            continue
        pattern = override.get("pattern")
        if not isinstance(pattern, str) or not pattern:
            continue
        if pattern in by_pattern:
            by_pattern[pattern] = {**by_pattern[pattern], **override}
        else:
            by_pattern[pattern] = deepcopy(override)
            order.append(pattern)

    return [by_pattern[pattern] for pattern in order if pattern in by_pattern]


def merge_site_policy(base: Dict[str, Any], overrides: Dict[str, Any]) -> Dict[str, Any]:
    """Deep-merge overrides onto base policy. Host rules merge by pattern."""
    if not overrides:
        return deepcopy(base)

    merged = deepcopy(base)
    for key, value in overrides.items():
        if key == "hosts" and isinstance(value, list):
            base_hosts = merged.get("hosts")
            if not isinstance(base_hosts, list):
                base_hosts = []
            merged["hosts"] = _merge_host_rules(base_hosts, value)
        elif value is not None:
            merged[key] = deepcopy(value)
    return merged


__all__ = ["merge_site_policy"]
