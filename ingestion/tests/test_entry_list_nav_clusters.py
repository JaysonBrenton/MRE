"""Unit tests for LiveRC entry list nav tab ID clustering (structural session-tab filtering)."""

from ingestion.connectors.liverc.parsers.entry_list_nav_clusters import (
    allowed_class_names_from_first_tab_cluster,
    cluster_sorted_tab_ids,
)


def test_cluster_sorted_tab_ids_rcra_style_gap():
    ids = [69557, 69558, 69563, 71129, 71130, 71132]
    assert cluster_sorted_tab_ids(ids) == [[69557, 69558, 69563], [71129, 71130, 71132]]


def test_allowed_class_names_from_first_cluster():
    """RCRA-style: registration block + session block (2+ tab IDs in the higher cluster)."""
    nav = [
        ("Buggy", "#Buggy_tab_69557"),
        ("Truggy", "#Truggy_tab_69558"),
        ("Semi A (Even) Practice", "#Semi_A_Even_Practice_tab_71130"),
        ("Semi B (Odd) Practice", "#Semi_B_Odd_Practice_tab_71131"),
    ]
    allowed = allowed_class_names_from_first_tab_cluster(nav)
    assert allowed == {"Buggy", "Truggy"}


def test_two_clusters_second_is_single_tab_no_filter():
    """Registration classes can share one tab-ID pool and one class in a distant pool (Canberra id=499602)."""
    nav = [
        ("1/8 Electric Buggy", "#18_Electric_Buggy_tab_36847"),
        ("1/8 Nitro Buggy", "#18_Nitro_Buggy_tab_36845"),
        ("1/10 Open", "#110_Open_tab_45083"),
    ]
    assert allowed_class_names_from_first_tab_cluster(nav) is None


def test_single_cluster_returns_none():
    nav = [
        ("A", "#A_tab_1"),
        ("B", "#B_tab_2"),
    ]
    assert allowed_class_names_from_first_tab_cluster(nav) is None


def test_scattered_registration_tab_ids_no_filter():
    """Same event, non-consecutive tab IDs (Psycho Nitro Blast–style); do not keep only lowest ID."""
    nav = [
        ("40+ Electric Buggy", "#40_Electric_Buggy_tab_2516"),
        ("Pro Electric Buggy", "#Pro_Electric_Buggy_tab_3632"),
        ("Int Electric Buggy", "#Int_Electric_Buggy_tab_3784"),
        ("Spt Electric Truggy", "#Spt_Electric_Truggy_tab_52674"),
        ("40+ Nitro Buggy", "#40_Nitro_Buggy_tab_5965"),
        ("Int Nitro Buggy", "#Int_Nitro_Buggy_tab_5969"),
        ("Open Etruggy", "#Open_Etruggy_tab_6065"),
    ]
    assert allowed_class_names_from_first_tab_cluster(nav) is None


def test_many_tab_id_pools_no_filter_psycho_style():
    """Full nav from racetime.liverc.com id=500696: 5+ tab-ID clusters; must not drop real classes."""
    nav = [
        ("Spt Electric Truggy", "#Spt_Electric_Truggy_tab_52674"),
        ("Spt Nitro Truggy", "#Spt_Nitro_Truggy_tab_857"),
        ("Spt Electric Buggy", "#Spt_Electric_Buggy_tab_848"),
        ("Spt Nitro Buggy", "#Spt_Nitro_Buggy_tab_845"),
        ("Pro Electric Buggy", "#Pro_Electric_Buggy_tab_3632"),
        ("40+ Nitro Buggy", "#40_Nitro_Buggy_tab_5965"),
        ("Pro Nitro Buggy", "#Pro_Nitro_Buggy_tab_843"),
        ("40+ Electric Buggy", "#40_Electric_Buggy_tab_2516"),
        ("Pro Nitro Truggy", "#Pro_Nitro_Truggy_tab_844"),
        ("Open Etruggy", "#Open_Etruggy_tab_6065"),
        ("Int Nitro Truggy", "#Int_Nitro_Truggy_tab_846"),
        ("Int Electric Buggy", "#Int_Electric_Buggy_tab_3784"),
        ("Int Nitro Buggy", "#Int_Nitro_Buggy_tab_5969"),
    ]
    assert allowed_class_names_from_first_tab_cluster(nav) is None
