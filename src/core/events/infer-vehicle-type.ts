/**
 * @fileoverview Vehicle type inference from race class names
 *
 * @created 2025-01-29
 * @creator Auto-generated
 * @lastModified 2025-01-29
 *
 * @description Infers vehicle type (car class) from race class names by extracting
 *              vehicle type components and inferring scale using heuristics.
 *
 * @purpose Provides inference logic to extract vehicle types like "1/8 Electric Buggy"
 *          from race class names like "40+ Electric Buggy" or "Pro Electric Buggy".
 */

/**
 * Infers vehicle type from a race class name.
 *
 * Extracts vehicle type components by removing age/skill groupings, then infers
 * scale using heuristics based on vehicle type patterns.
 *
 * @param raceClassName - The race class name (e.g., "40+ Electric Buggy", "Pro Electric Buggy")
 * @returns Inferred vehicle type (e.g., "1/8 Electric Buggy") or "Unknown" if inference fails
 *
 * @example
 * inferVehicleType("40+ Electric Buggy") // "1/8 Electric Buggy"
 * inferVehicleType("Pro Nitro Buggy") // "1/8 Nitro Buggy"
 * inferVehicleType("Spt. Electric Truck") // "1/10 Electric Truck"
 * inferVehicleType("Int. 2WD Buggy") // "1/10 2WD Buggy"
 */
export function inferVehicleType(raceClassName: string): string {
  if (!raceClassName || !raceClassName.trim()) {
    return "Unknown"
  }

  // Step 1: Remove age groupings (40+, 50+, etc.)
  let cleaned = raceClassName.trim()
  cleaned = cleaned.replace(/\d+\+\s*/gi, "") // Remove "40+", "50+", etc.

  // Step 2: Remove skill groupings (Pro, Int, Spt., Sport, Intermediate, etc.)
  const skillGroupings = [
    /^Pro\s+/i,
    /^Int\.?\s+/i,
    /^Spt\.?\s+/i,
    /^Sport\s+/i,
    /^Intermediate\s+/i,
    /^Junior\s+/i,
    /^Expert\s+/i,
    /^Masters?\s+/i,
  ]

  for (const pattern of skillGroupings) {
    cleaned = cleaned.replace(pattern, "")
  }

  // Also remove from middle/end if present
  cleaned = cleaned.replace(
    /\s+(Pro|Int\.?|Spt\.?|Sport|Intermediate|Junior|Expert|Masters?)$/i,
    ""
  )

  cleaned = cleaned.trim()

  if (!cleaned) {
    return "Unknown"
  }

  // Step 3: Extract vehicle type components
  // Look for patterns: "Electric Buggy", "Nitro Buggy", "Electric Truck", "Nitro Truck", etc.
  const vehicleTypeMatch = cleaned.match(
    /(?:Electric|Nitro)\s+(?:Buggy|Truck|Truggy)|(?:Buggy|Truck|Truggy)(?:\s+(?:Electric|Nitro))?/i
  )

  if (!vehicleTypeMatch) {
    // Try to find any vehicle type mention
    if (/\b(Buggy|Truck|Truggy)\b/i.test(cleaned)) {
      // Has vehicle type but unclear power type - use cleaned string as base
      cleaned = cleaned
    } else {
      return "Unknown"
    }
  }

  // Step 4: Infer scale using heuristics
  const upper = cleaned.toUpperCase()

  // Check for explicit scale indicators
  if (/\b(2WD|4WD)\b/i.test(cleaned)) {
    // 2WD/4WD indicates 1/10 scale
    if (/\b2WD\b/i.test(cleaned)) {
      return `1/10 2WD ${extractVehicleType(cleaned)}`
    } else if (/\b4WD\b/i.test(cleaned)) {
      return `1/10 4WD ${extractVehicleType(cleaned)}`
    }
  }

  // Check for Nitro (typically 1/8 scale)
  if (/\bNITRO\b/i.test(upper)) {
    return `1/8 ${extractVehicleType(cleaned)}`
  }

  // Check for Truck (without Nitro, typically 1/10 scale)
  if (/\bTRUCK\b/i.test(upper) && !/\bNITRO\b/i.test(upper)) {
    return `1/10 ${extractVehicleType(cleaned)}`
  }

  // Check for Truggy (typically 1/8 scale, but can be 1/10)
  if (/\bTRUGGY\b/i.test(upper)) {
    // Default to 1/8 for Truggy
    return `1/8 ${extractVehicleType(cleaned)}`
  }

  // Electric Buggy (no other indicators) - default to 1/8 scale
  if (/\bELECTRIC\s+BUGGY\b/i.test(upper) || /\bBUGGY\b/i.test(upper)) {
    return `1/8 ${extractVehicleType(cleaned)}`
  }

  // Fallback: return cleaned string with "Unknown" scale
  return `Unknown ${extractVehicleType(cleaned)}`
}

/**
 * Extracts the vehicle type portion from a cleaned race class name.
 *
 * @param cleaned - The cleaned race class name
 * @returns Vehicle type string (e.g., "Electric Buggy", "Nitro Truck")
 */
function extractVehicleType(cleaned: string): string {
  // Try to extract "PowerType VehicleType" pattern
  const match = cleaned.match(
    /((?:Electric|Nitro)\s+(?:Buggy|Truck|Truggy))|((?:Buggy|Truck|Truggy)(?:\s+(?:Electric|Nitro))?)/i
  )
  if (match) {
    return match[0].trim()
  }

  // Fallback: return cleaned string
  return cleaned.trim()
}
