"""Unit tests for ingestion/common/race_vehicle_normalization.py"""

from ingestion.common.race_vehicle_normalization import (
    compute_normalization_for_event,
    is_placeholder_class,
    race_is_lcq_row,
)


class _Race:
    def __init__(self, rid, class_name, race_label, race_order, session_type, section_header, start_time):
        self.id = rid
        self.class_name = class_name
        self.race_label = race_label
        self.race_order = race_order
        self.session_type = session_type
        self.section_header = section_header
        self.start_time = start_time


def test_is_placeholder_class():
    assert is_placeholder_class("Track Maintenance")
    assert is_placeholder_class("Track Maintainance")
    assert not is_placeholder_class("Buggy")


def test_race_is_lcq_row():
    assert race_is_lcq_row("Last Chance Qualifier", "Last Chance Qualifier A-Main")
    assert not race_is_lcq_row("Buggy", "Buggy A-Main")


def test_compute_normalization_direct_erc_and_lcq_merge():
    """
    LCQ row follows Buggy A-main on schedule → merge vehicle from Buggy class.
    """
    races = [
        _Race(
            "1",
            "Buggy",
            "Buggy (Heat 1/7)",
            1,
            "qualifying",
            "Qualifier Round 1",
            None,
        ),
        _Race(
            "2",
            "Last Chance Qualifier",
            "Last Chance Qualifier A-Main",
            10,
            "main",
            "Main Events",
            None,
        ),
        _Race(
            "3",
            "Buggy",
            "Buggy (Buggy 1/16 Odd Final)",
            11,
            "main",
            "Main Events",
            None,
        ),
    ]
    erc_by = {
        "Buggy": ("erc-buggy", "1/8 Nitro Buggy"),
    }
    out = compute_normalization_for_event(races, erc_by, {}, {})
    assert out["1"]["vehicle_type"] == "1/8 Nitro Buggy"
    assert out["1"]["event_race_class_id"] == "erc-buggy"
    assert out["3"]["vehicle_type"] == "1/8 Nitro Buggy"
    assert out["2"]["vehicle_type"] == "1/8 Nitro Buggy"
    assert out["2"]["event_race_class_id"] == "erc-buggy"
