"""Unit tests for session type inference and race normalization in Normalizer."""

import pytest

from ingestion.connectors.liverc.models import ConnectorRaceSummary
from ingestion.ingestion.normalizer import Normalizer


def test_infer_session_type_seeding_from_section_header():
    """Section header 'Seeding Round 1' should infer 'seeding'."""
    assert Normalizer.infer_session_type(
        "Buggy Expert (Heat 1/4)",
        "",
        section_header="Seeding Round 1",
    ) == "seeding"


def test_infer_session_type_practice_from_section_header():
    """Section header 'Practice Round 1' should infer 'practice'."""
    assert Normalizer.infer_session_type(
        "Buggy Expert (Heat 1/4)",
        "",
        section_header="Practice Round 1",
    ) == "practice"


def test_infer_session_type_heat_without_section_header():
    """Heat label without seeding/practice header infers 'heat'."""
    assert Normalizer.infer_session_type("Buggy Expert (Heat 1/4)", "") == "heat"


def test_infer_session_type_main():
    """Main label infers 'main'."""
    assert Normalizer.infer_session_type("1/8 Nitro Buggy A-Main", "") == "main"


def test_infer_session_type_seeding_overrides_heat():
    """Section header seeding takes precedence over heat in label."""
    # Same label as qualifier heat, but section says Seeding
    assert Normalizer.infer_session_type(
        "Buggy Expert (Heat 1/4)",
        "",
        section_header="Seeding Round 2",
    ) == "seeding"


def test_infer_session_type_qualifier_from_section_header():
    """Section header 'Qualifier Round 4' should infer 'qualifying'."""
    # Race label has "Heat" but section says Qualifier
    assert Normalizer.infer_session_type(
        "Buggy Expert (Heat 1/4)",
        "",
        section_header="Qualifier Round 4",
    ) == "qualifying"


def test_normalize_race_prefers_parser_race_order_over_label():
    """Parser's race_order (from 'Race X:' in full label) must override parse_race_label result.

    parse_race_label extracts local numbers from the race_label (e.g. 1 from "Heat 1/3").
    Using that would incorrectly put Practice (1) and Heat 1/3 (1) at the same order,
    breaking session order in lap trend charts.
    """
    # Parser extracted race_order=8 from "Race 8: EP Buggy (EP Buggy Heat 1/3)"
    # parse_race_label would extract 1 from "Heat 1/3" - we must use 8
    race = ConnectorRaceSummary(
        source_race_id="123",
        race_full_label="Race 8: EP Buggy (EP Buggy Heat 1/3)",
        class_name="EP Buggy",
        race_label="EP Buggy Heat 1/3",
        race_order=8,
        race_url="https://example.com/race/123",
        start_time=None,
    )
    result = Normalizer.normalize_race(race)
    assert result["race_order"] == 8, "Must use parser's race_order (8), not label-derived (1)"


def test_normalize_race_falls_back_to_label_order_when_parser_missing():
    """When parser doesn't provide race_order, use parse_race_label result."""
    race = ConnectorRaceSummary(
        source_race_id="123",
        race_full_label="EP Buggy Heat 2/3",  # No "Race X:" prefix
        class_name="EP Buggy",
        race_label="EP Buggy Heat 2/3",
        race_order=None,
        race_url="https://example.com/race/123",
        start_time=None,
    )
    result = Normalizer.normalize_race(race)
    assert result["race_order"] == 2, "Fall back to parse_race_label (2 from Heat 2/3)"
