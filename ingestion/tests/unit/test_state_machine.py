# @fileoverview State machine unit tests
# 
# @created 2025-01-27
# @creator Jayson Brenton
# @lastModified 2025-01-27
# 
# @description Unit tests for ingestion state machine

import pytest
from ingestion.db.models import IngestDepth
from ingestion.ingestion.errors import StateMachineError
from ingestion.ingestion.state_machine import IngestionStateMachine


def test_valid_transition_none_to_laps_full():
    """Test valid transition from none to laps_full."""
    IngestionStateMachine.validate_transition(
        IngestDepth.NONE,
        "laps_full",
    )
    assert True  # No exception raised


def test_valid_transition_laps_full_to_laps_full():
    """Test valid re-ingestion (laps_full to laps_full)."""
    IngestionStateMachine.validate_transition(
        IngestDepth.LAPS_FULL,
        "laps_full",
    )
    assert True  # No exception raised


def test_invalid_transition_laps_full_to_none():
    """Test forbidden transition from laps_full to none."""
    with pytest.raises(StateMachineError):
        IngestionStateMachine.validate_transition(
            IngestDepth.LAPS_FULL,
            "none",
        )


def test_invalid_depth():
    """Test invalid depth value."""
    with pytest.raises(StateMachineError):
        IngestionStateMachine.validate_transition(
            IngestDepth.NONE,
            "invalid_depth",
        )

