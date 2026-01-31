/**
 * @fileoverview Vehicle type dropdown options generator
 *
 * @created 2025-01-29
 * @creator Auto-generated
 * @lastModified 2025-01-29
 *
 * @description Generates dropdown options for vehicle type selection based on
 *              inferred vehicle type from race class names.
 *
 * @purpose Provides dynamic dropdown options that are contextually relevant
 *          to the inferred vehicle type, helping users select the correct
 *          vehicle type when reviewing/editing.
 */

/**
 * Generates dropdown options for vehicle type selection based on inferred vehicle type.
 *
 * Returns a list of related vehicle types that the user might want to select,
 * including the inferred value and similar alternatives.
 *
 * @param inferredVehicleType - The inferred vehicle type (e.g., "1/8 Electric Buggy")
 * @returns Array of vehicle type options for the dropdown
 *
 * @example
 * getVehicleTypeOptions("1/8 Electric Buggy")
 * // Returns: ["1/8 Electric Buggy", "1/10 2WD Buggy", "1/10 4WD Buggy", "Unknown"]
 */
export function getVehicleTypeOptions(inferredVehicleType: string | null): string[] {
  const options = new Set<string>()

  // Always include "Unknown" option
  options.add("Unknown")

  if (!inferredVehicleType || inferredVehicleType === "Unknown") {
    // If no inference or unknown, return all common options
    return [
      "Unknown",
      "1/8 Nitro Buggy",
      "1/8 Electric Buggy",
      "1/8 Nitro Truggy",
      "1/8 Electric Truggy",
      "1/10 2WD Buggy Modified",
      "1/10 2WD Buggy Stock",
      "1/10 4WD Buggy Modified",
      "1/10 4WD Buggy Stock",
      "1/10 Electric Truck",
    ]
  }

  const upper = inferredVehicleType.toUpperCase()

  // If inferred "Electric Buggy" - show 1/8 and 1/10 options
  if (
    /\bELECTRIC\s+BUGGY\b/i.test(upper) ||
    (/\bBUGGY\b/i.test(upper) && /\bELECTRIC\b/i.test(upper))
  ) {
    options.add("1/8 Electric Buggy")
    options.add("1/10 2WD Buggy Modified")
    options.add("1/10 2WD Buggy Stock")
    options.add("1/10 4WD Buggy Modified")
    options.add("1/10 4WD Buggy Stock")
    return Array.from(options).sort()
  }

  // If inferred "Nitro Buggy" - show 1/8 options
  if (/\bNITRO\s+BUGGY\b/i.test(upper) || (/\bBUGGY\b/i.test(upper) && /\bNITRO\b/i.test(upper))) {
    options.add("1/8 Nitro Buggy")
    return Array.from(options).sort()
  }

  // If inferred "Electric Truck" - show 1/10 options
  if (
    /\bELECTRIC\s+TRUCK\b/i.test(upper) ||
    (/\bTRUCK\b/i.test(upper) && /\bELECTRIC\b/i.test(upper))
  ) {
    options.add("1/10 Electric Truck")
    return Array.from(options).sort()
  }

  // If inferred "Nitro Truck" - show 1/8 options
  if (/\bNITRO\s+TRUCK\b/i.test(upper) || (/\bTRUCK\b/i.test(upper) && /\bNITRO\b/i.test(upper))) {
    options.add("1/8 Nitro Truck")
    return Array.from(options).sort()
  }

  // If inferred "Truggy" - show 1/8 options
  if (/\bTRUGGY\b/i.test(upper)) {
    if (/\bELECTRIC\b/i.test(upper)) {
      options.add("1/8 Electric Truggy")
    } else if (/\bNITRO\b/i.test(upper)) {
      options.add("1/8 Nitro Truggy")
    } else {
      options.add("1/8 Electric Truggy")
      options.add("1/8 Nitro Truggy")
    }
    return Array.from(options).sort()
  }

  // If inferred "2WD Buggy" - show 1/10 options
  if (/\b2WD\s+BUGGY\b/i.test(upper) || /\bBUGGY.*2WD\b/i.test(upper)) {
    options.add("1/10 2WD Buggy Modified")
    options.add("1/10 2WD Buggy Stock")
    return Array.from(options).sort()
  }

  // If inferred "4WD Buggy" - show 1/10 options
  if (/\b4WD\s+BUGGY\b/i.test(upper) || /\bBUGGY.*4WD\b/i.test(upper)) {
    options.add("1/10 4WD Buggy Modified")
    options.add("1/10 4WD Buggy Stock")
    return Array.from(options).sort()
  }

  // Default: include the inferred value and common alternatives
  options.add(inferredVehicleType)

  // Add common alternatives based on what we can detect
  if (/\bBUGGY\b/i.test(upper)) {
    options.add("1/8 Electric Buggy")
    options.add("1/10 2WD Buggy Modified")
    options.add("1/10 4WD Buggy Modified")
  }

  if (/\bTRUCK\b/i.test(upper)) {
    options.add("1/10 Electric Truck")
    options.add("1/8 Nitro Truck")
  }

  return Array.from(options).sort()
}

/**
 * Gets all available vehicle type options (comprehensive list).
 *
 * @returns Array of all known vehicle types
 */
export function getAllVehicleTypeOptions(): string[] {
  return [
    "Unknown",
    "1/8 Nitro Buggy",
    "1/8 Electric Buggy",
    "1/8 Nitro Truggy",
    "1/8 Electric Truggy",
    "1/10 2WD Buggy Modified",
    "1/10 2WD Buggy Stock",
    "1/10 4WD Buggy Modified",
    "1/10 4WD Buggy Stock",
    "1/10 Electric Truck",
    "1/10 Nitro Truck",
  ]
}
