"""
LiveRC entry list pages sometimes add extra nav tabs that are session buckets (e.g. semi practice,
LCQ) with new Bootstrap tab IDs in a different numeric range than the primary registration classes.

We keep only the first cluster of tab IDs (sorted), which matches the primary class tabs on pages
such as 2026 RCRA Nationals (tab IDs 69557–69563 vs 71129–71132 for session rows).

This is structural (href tab IDs), not string heuristics on class labels.
"""

from __future__ import annotations

import re
from typing import Dict, List, Optional, Set, Tuple, TypeVar

T = TypeVar("T")

_TAB_ID_IN_HREF = re.compile(r"_tab_(\d+)\s*(?:#.*)?$")

# Gap between RCRA registration tabs (69563) and session tabs (71129) is ~1500; within a cluster
# consecutive tabs differ by 1.
MAX_NAV_TAB_ID_GAP = 500


def cluster_sorted_tab_ids(sorted_ids: List[int], max_gap: int = MAX_NAV_TAB_ID_GAP) -> List[List[int]]:
    """Split sorted distinct tab IDs into clusters when there is a large gap (new LiveRC batch)."""
    if not sorted_ids:
        return []
    clusters: List[List[int]] = [[sorted_ids[0]]]
    for x in sorted_ids[1:]:
        if x - clusters[-1][-1] <= max_gap:
            clusters[-1].append(x)
        else:
            clusters.append([x])
    return clusters


def tab_ids_from_nav_hrefs(nav_link_pairs: List[Tuple[str, str]]) -> List[Tuple[str, int]]:
    """Pairs of (normalized class label, tab id) from nav pill hrefs (#ClassName_tab_69557)."""
    out: List[Tuple[str, int]] = []
    for label, href in nav_link_pairs:
        href = (href or "").strip()
        if not href:
            continue
        m = _TAB_ID_IN_HREF.search(href)
        if not m:
            continue
        try:
            tab_id = int(m.group(1))
        except ValueError:
            continue
        out.append((label, tab_id))
    return out


def allowed_class_names_from_first_tab_cluster(
    nav_link_pairs: List[Tuple[str, str]],
) -> Optional[Set[str]]:
    """
    If nav pills show multiple tab-ID clusters, return class names in the first (lowest-ID) cluster.
    Returns None when filtering should not apply (single cluster, no tab IDs, or empty).
    """
    pairs = tab_ids_from_nav_hrefs(nav_link_pairs)
    if len(pairs) < 2:
        return None
    distinct_ids = sorted({tid for _, tid in pairs})
    clusters = cluster_sorted_tab_ids(distinct_ids)
    if len(clusters) <= 1:
        return None
    keep_ids = set(clusters[0])
    allowed = {label for label, tid in pairs if tid in keep_ids}
    return allowed if allowed else None


def filter_dict_by_allowed_keys(d: Dict[str, T], allowed: set[str]) -> Dict[str, T]:
    return {k: v for k, v in d.items() if k in allowed}
