"""Unit tests for LiveRC entry list nav tab ID clustering (structural session-tab filtering)."""

from ingestion.connectors.liverc.parsers.entry_list_nav_clusters import (
    allowed_class_names_from_first_tab_cluster,
    cluster_sorted_tab_ids,
)


def test_cluster_sorted_tab_ids_rcra_style_gap():
    ids = [69557, 69558, 69563, 71129, 71130, 71132]
    assert cluster_sorted_tab_ids(ids) == [[69557, 69558, 69563], [71129, 71130, 71132]]


def test_allowed_class_names_from_first_cluster():
    nav = [
        ("Buggy", "#Buggy_tab_69557"),
        ("Truggy", "#Truggy_tab_69558"),
        ("Semi A (Even) Practice", "#Semi_A_Even_Practice_tab_71130"),
    ]
    allowed = allowed_class_names_from_first_tab_cluster(nav)
    assert allowed == {"Buggy", "Truggy"}


def test_single_cluster_returns_none():
    nav = [
        ("A", "#A_tab_1"),
        ("B", "#B_tab_2"),
    ]
    assert allowed_class_names_from_first_tab_cluster(nav) is None
