# @fileoverview Practice driver identity for practice day ingestion
#
# Used for practice day ingestion. Transponder when present (including for
# Unknown Driver); else synthetic per session.

from typing import Optional


def get_practice_source_driver_id(session_id: str, transponder_number: Optional[str]) -> str:
    """
    Compute source_driver_id for a practice session.
    
    When transponder is present (non-empty after strip), use it so that
    "Unknown Driver" sessions with a transponder are differentiated and
    laps can be extracted. When transponder is missing, use a synthetic
    id per session.
    
    Args:
        session_id: Practice session ID from LiveRC
        transponder_number: Transponder from list/detail, or None
        
    Returns:
        source_driver_id string (transponder or practice_session_{session_id})
    """
    if transponder_number is not None and str(transponder_number).strip():
        return str(transponder_number).strip()
    return f"practice_session_{session_id}"
