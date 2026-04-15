"""Garmin FIT (.fit) is not a supported product format — reject uploads early."""

from __future__ import annotations


def is_garmin_fit_file(raw_bytes: bytes, original_file_name: str) -> bool:
    """True if the bytes or filename indicate a Garmin FIT activity file."""
    name = (original_file_name or "").lower()
    if name.endswith(".fit"):
        return True
    if len(raw_bytes) >= 12 and raw_bytes[8:12] == b".FIT":
        return True
    return False
