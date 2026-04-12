"""Stable telemetry parse / pipeline error codes (match design docs)."""


class TelemetryParseError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.detail = message
