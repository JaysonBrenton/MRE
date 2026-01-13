# @fileoverview Vehicle type inference from race class names
#
# @created 2025-01-29
# @creator Auto-generated
# @lastModified 2025-01-29
#
# @description Infers vehicle type (car class) from race class names by extracting
#              vehicle type components and inferring scale using heuristics.
#
# @purpose Provides inference logic to extract vehicle types like "1/8 Electric Buggy"
#          from race class names like "40+ Electric Buggy" or "Pro Electric Buggy".

import re
from typing import Optional


def infer_vehicle_type(race_class_name: str) -> str:
    """
    Infers vehicle type from a race class name.
    
    Extracts vehicle type components by removing age/skill groupings, then infers
    scale using heuristics based on vehicle type patterns.
    
    Args:
        race_class_name: The race class name (e.g., "40+ Electric Buggy", "Pro Electric Buggy")
    
    Returns:
        Inferred vehicle type (e.g., "1/8 Electric Buggy") or "Unknown" if inference fails
    
    Examples:
        >>> infer_vehicle_type("40+ Electric Buggy")
        '1/8 Electric Buggy'
        >>> infer_vehicle_type("Pro Nitro Buggy")
        '1/8 Nitro Buggy'
        >>> infer_vehicle_type("Spt. Electric Truck")
        '1/10 Electric Truck'
        >>> infer_vehicle_type("Int. 2WD Buggy")
        '1/10 2WD Buggy'
    """
    if not race_class_name or not race_class_name.strip():
        return "Unknown"
    
    # Step 1: Remove age groupings (40+, 50+, etc.)
    cleaned = race_class_name.strip()
    cleaned = re.sub(r'\d+\+\s*', '', cleaned, flags=re.IGNORECASE)  # Remove "40+", "50+", etc.
    
    # Step 2: Remove skill groupings (Pro, Int, Spt., Sport, Intermediate, etc.)
    skill_groupings = [
        r'^Pro\s+',
        r'^Int\.?\s+',
        r'^Spt\.?\s+',
        r'^Sport\s+',
        r'^Intermediate\s+',
        r'^Junior\s+',
        r'^Expert\s+',
        r'^Masters?\s+',
    ]
    
    for pattern in skill_groupings:
        cleaned = re.sub(pattern, '', cleaned, flags=re.IGNORECASE)
    
    # Also remove from middle/end if present
    cleaned = re.sub(r'\s+(Pro|Int\.?|Spt\.?|Sport|Intermediate|Junior|Expert|Masters?)$', '', cleaned, flags=re.IGNORECASE)
    
    cleaned = cleaned.strip()
    
    if not cleaned:
        return "Unknown"
    
    # Step 3: Extract vehicle type components
    # Look for patterns: "Electric Buggy", "Nitro Buggy", "Electric Truck", "Nitro Truck", etc.
    vehicle_type_match = re.search(
        r'(?:Electric|Nitro)\s+(?:Buggy|Truck|Truggy)|(?:Buggy|Truck|Truggy)(?:\s+(?:Electric|Nitro))?',
        cleaned,
        re.IGNORECASE
    )
    
    if not vehicle_type_match:
        # Try to find any vehicle type mention
        if re.search(r'\b(Buggy|Truck|Truggy)\b', cleaned, re.IGNORECASE):
            # Has vehicle type but unclear power type - use cleaned string as base
            pass
        else:
            return "Unknown"
    
    # Step 4: Infer scale using heuristics
    upper = cleaned.upper()
    
    # Check for explicit scale indicators
    if re.search(r'\b(2WD|4WD)\b', cleaned, re.IGNORECASE):
        # 2WD/4WD indicates 1/10 scale
        if re.search(r'\b2WD\b', cleaned, re.IGNORECASE):
            return f"1/10 2WD {_extract_vehicle_type(cleaned)}"
        elif re.search(r'\b4WD\b', cleaned, re.IGNORECASE):
            return f"1/10 4WD {_extract_vehicle_type(cleaned)}"
    
    # Check for Nitro (typically 1/8 scale)
    if re.search(r'\bNITRO\b', upper):
        return f"1/8 {_extract_vehicle_type(cleaned)}"
    
    # Check for Truck (without Nitro, typically 1/10 scale)
    if re.search(r'\bTRUCK\b', upper) and not re.search(r'\bNITRO\b', upper):
        return f"1/10 {_extract_vehicle_type(cleaned)}"
    
    # Check for Truggy (typically 1/8 scale, but can be 1/10)
    if re.search(r'\bTRUGGY\b', upper):
        # Default to 1/8 for Truggy
        return f"1/8 {_extract_vehicle_type(cleaned)}"
    
    # Electric Buggy (no other indicators) - default to 1/8 scale
    if re.search(r'\bELECTRIC\s+BUGGY\b', upper) or re.search(r'\bBUGGY\b', upper):
        return f"1/8 {_extract_vehicle_type(cleaned)}"
    
    # Fallback: return cleaned string with "Unknown" scale
    return f"Unknown {_extract_vehicle_type(cleaned)}"


def _extract_vehicle_type(cleaned: str) -> str:
    """
    Extracts the vehicle type portion from a cleaned race class name.
    
    Args:
        cleaned: The cleaned race class name
    
    Returns:
        Vehicle type string (e.g., "Electric Buggy", "Nitro Truck")
    """
    # Try to extract "PowerType VehicleType" pattern
    match = re.search(
        r'((?:Electric|Nitro)\s+(?:Buggy|Truck|Truggy))|((?:Buggy|Truck|Truggy)(?:\s+(?:Electric|Nitro))?)',
        cleaned,
        re.IGNORECASE
    )
    if match:
        return match.group(0).strip()
    
    # Fallback: return cleaned string
    return cleaned.strip()

