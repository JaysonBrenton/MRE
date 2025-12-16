# @fileoverview Ingestion state machine
# 
# @created 2025-01-27
# @creator Jayson Brenton
# @lastModified 2025-01-27
# 
# @description State machine for event ingestion depth transitions
# 
# @purpose Enforces valid state transitions and validates entry criteria
#          per ingestion state machine specification.

from typing import Optional
from datetime import datetime

from ingestion.db.models import IngestDepth
from ingestion.ingestion.errors import StateMachineError

# Valid states for V1
VALID_STATES = {IngestDepth.NONE, IngestDepth.LAPS_FULL}
VALID_DEPTHS = {"none", "laps_full"}  # String versions - V1 supports only these two


class IngestionStateMachine:
    """
    State machine for event ingestion depth.
    
    V1 specification:
    - States: none, laps_full
    - Allowed transitions: none → laps_full, laps_full → laps_full
    - Forbidden: laps_full → none, any downgrade transitions
    """
    
    @staticmethod
    def validate_transition(
        current_state: IngestDepth,
        requested_depth: str,
        event_id: Optional[str] = None,
    ) -> None:
        """
        Validate state transition.
        
        Args:
            current_state: Current ingest_depth state
            requested_depth: Requested depth (string)
            event_id: Event ID for error messages
        
        Raises:
            StateMachineError: If transition is invalid
        """
        # Validate requested depth
        if requested_depth not in VALID_DEPTHS:
            raise StateMachineError(
                f"Invalid ingest_depth: {requested_depth}. Valid values: {', '.join(VALID_DEPTHS)}",
                current_state=current_state.value if current_state else None,
                requested_state=requested_depth,
                event_id=event_id,
            )
        
        # Convert string to enum for comparison
        requested_enum = IngestDepth(requested_depth)
        
        # Check forbidden transitions
        if current_state == IngestDepth.LAPS_FULL:
            if requested_enum == IngestDepth.NONE:
                raise StateMachineError(
                    "Cannot downgrade from laps_full to none",
                    current_state=current_state.value,
                    requested_state=requested_depth,
                    event_id=event_id,
                )
        
        # Check invalid transitions from none
        if current_state == IngestDepth.NONE:
            if requested_enum not in {IngestDepth.LAPS_FULL}:
                raise StateMachineError(
                    f"Cannot transition from none to {requested_depth}. Only laps_full is valid for V1.",
                    current_state=current_state.value,
                    requested_state=requested_depth,
                    event_id=event_id,
                )
    
    @staticmethod
    def is_transition_allowed(
        current_state: IngestDepth,
        requested_depth: str,
    ) -> bool:
        """
        Check if transition is allowed without raising exception.
        
        Args:
            current_state: Current ingest_depth state
            requested_depth: Requested depth (string)
        
        Returns:
            True if transition is allowed
        """
        try:
            IngestionStateMachine.validate_transition(current_state, requested_depth)
            return True
        except StateMachineError:
            return False
    
    @staticmethod
    def validate_entry_criteria_none(event_exists: bool, has_races: bool) -> None:
        """
        Validate entry criteria for 'none' state.
        
        Args:
            event_exists: Whether event row exists
            has_races: Whether any races exist for this event
        
        Raises:
            StateMachineError: If criteria not met
        """
        if not event_exists:
            raise StateMachineError("Event must exist to be in 'none' state")
        
        if has_races:
            raise StateMachineError(
                "Event cannot be in 'none' state if races exist",
                current_state="none",
            )
    
    @staticmethod
    def validate_entry_criteria_laps_full(
        event_exists: bool,
        has_races: bool,
        has_results: bool,
        has_laps: bool,
    ) -> None:
        """
        Validate entry criteria for 'laps_full' state.
        
        Args:
            event_exists: Whether event row exists
            has_races: Whether races exist
            has_results: Whether results exist
            has_laps: Whether laps exist
        
        Raises:
            StateMachineError: If criteria not met
        """
        if not event_exists:
            raise StateMachineError("Event must exist to be in 'laps_full' state")
        
        if not has_races:
            raise StateMachineError(
                "Event cannot be in 'laps_full' state without races",
                current_state="laps_full",
            )
        
        if not has_results:
            raise StateMachineError(
                "Event cannot be in 'laps_full' state without results",
                current_state="laps_full",
            )
        
        if not has_laps:
            raise StateMachineError(
                "Event cannot be in 'laps_full' state without laps",
                current_state="laps_full",
            )

