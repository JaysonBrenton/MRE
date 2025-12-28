# @fileoverview Custom error types for ingestion service
# 
# @created 2025-01-27
# @creator Jayson Brenton
# @lastModified 2025-01-27
# 
# @description Domain-specific exceptions for ingestion operations
# 
# @purpose Provides structured error types that clearly distinguish
#          between connector, normalisation, persistence, and state
#          machine errors per ingestion error handling specification.

from typing import Any, Dict, Optional


class IngestionError(Exception):
    """Base class for all ingestion-related errors."""
    
    def __init__(
        self,
        message: str,
        code: str,
        source: str,
        details: Optional[Dict[str, Any]] = None
    ):
        """
        Initialize ingestion error.
        
        Args:
            message: Human-readable error message
            code: Machine-readable error code
            source: Error source (connector, normalisation, persistence, state_machine)
            details: Optional structured metadata
        """
        super().__init__(message)
        self.message = message
        self.code = code
        self.source = source
        self.details = details or {}
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert error to dictionary for API responses."""
        return {
            "error": {
                "code": self.code,
                "source": self.source,
                "message": self.message,
                "details": self.details,
            }
        }


# Connector Layer Errors

class ConnectorError(IngestionError):
    """Base class for connector-related errors."""
    
    def __init__(self, message: str, code: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, code, "connector", details)


class ConnectorHTTPError(ConnectorError):
    """HTTP-related errors from connector (network, timeouts, status codes)."""
    
    def __init__(self, message: str, status_code: Optional[int] = None, url: Optional[str] = None):
        details = {}
        if status_code:
            details["status_code"] = status_code
        if url:
            details["url"] = url
        super().__init__(message, "CONNECTOR_HTTP_ERROR", details)


class EventPageFormatError(ConnectorError):
    """Event page HTML structure is malformed or unexpected."""
    
    def __init__(self, message: str, url: Optional[str] = None):
        details = {}
        if url:
            details["url"] = url
        super().__init__(message, "EVENT_PAGE_FORMAT_ERROR", details)


class RacePageFormatError(ConnectorError):
    """Race page HTML structure is malformed or unexpected."""
    
    def __init__(self, message: str, url: Optional[str] = None, race_id: Optional[str] = None):
        details = {}
        if url:
            details["url"] = url
        if race_id:
            details["race_id"] = race_id
        super().__init__(message, "RACE_PAGE_FORMAT_ERROR", details)


class LapTableMissingError(ConnectorError):
    """Lap table data cannot be found or extracted."""
    
    def __init__(self, message: str, driver_id: Optional[str] = None, race_id: Optional[str] = None):
        details = {}
        if driver_id:
            details["driver_id"] = driver_id
        if race_id:
            details["race_id"] = race_id
        super().__init__(message, "LAP_TABLE_MISSING_ERROR", details)


class UnsupportedLiveRCVariantError(ConnectorError):
    """LiveRC page structure has changed and is no longer supported."""
    
    def __init__(self, message: str, url: Optional[str] = None, page_type: Optional[str] = None):
        details = {}
        if url:
            details["url"] = url
        if page_type:
            details["page_type"] = page_type
        super().__init__(message, "UNSUPPORTED_LIVERC_VARIANT_ERROR", details)


# Normalisation Errors

class NormalisationError(IngestionError):
    """Errors during data normalisation."""
    
    def __init__(self, message: str, field: Optional[str] = None, value: Optional[Any] = None):
        details = {}
        if field:
            details["field"] = field
        if value is not None:
            details["value"] = str(value)
        super().__init__(message, "NORMALISATION_ERROR", "normalisation", details)


# Validation Errors

class ValidationError(IngestionError):
    """Data validation failures."""
    
    def __init__(
        self,
        message: str,
        field: Optional[str] = None,
        event_id: Optional[str] = None,
        race_id: Optional[str] = None,
        driver_id: Optional[str] = None
    ):
        details = {}
        if field:
            details["field"] = field
        if event_id:
            details["event_id"] = event_id
        if race_id:
            details["race_id"] = race_id
        if driver_id:
            details["driver_id"] = driver_id
        super().__init__(message, "VALIDATION_ERROR", "normalisation", details)


# State Machine Errors

class StateMachineError(IngestionError):
    """State machine transition violations."""
    
    def __init__(
        self,
        message: str,
        current_state: Optional[str] = None,
        requested_state: Optional[str] = None,
        event_id: Optional[str] = None
    ):
        details = {}
        if current_state:
            details["current_state"] = current_state
        if requested_state:
            details["requested_state"] = requested_state
        if event_id:
            details["event_id"] = event_id
        super().__init__(message, "STATE_MACHINE_ERROR", "state_machine", details)


class IngestionInProgressError(StateMachineError):
    """Ingestion is already running for this event."""
    
    def __init__(self, event_id: str):
        super().__init__(
            f"Ingestion already in progress for event {event_id}",
            requested_state="laps_full",
            event_id=event_id
        )
        self.code = "INGESTION_IN_PROGRESS"


# Persistence Errors

class PersistenceError(IngestionError):
    """Database operation errors."""
    
    def __init__(self, message: str, operation: Optional[str] = None):
        details = {}
        if operation:
            details["operation"] = operation
        super().__init__(message, "PERSISTENCE_ERROR", "persistence", details)


class ConstraintViolationError(PersistenceError):
    """Database constraint violation (should not happen with correct idempotent logic)."""
    
    def __init__(self, message: str, constraint: Optional[str] = None):
        details = {}
        if constraint:
            details["constraint"] = constraint
        # Call PersistenceError.__init__ which will then call IngestionError.__init__
        # Pass operation as None since we're using details for constraint info
        super().__init__(message, operation=None)
        # Update details with constraint
        if constraint:
            self.details["constraint"] = constraint
        self.code = "CONSTRAINT_VIOLATION_ERROR"

