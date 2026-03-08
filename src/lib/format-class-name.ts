/**
 * @fileoverview Formats racing class names for display.
 *
 * @description Corrects known typos from LiveRC and other sources.
 *              Use when displaying class names to users.
 *
 * @purpose Ensures consistent, correct display of class names in the UI.
 */

/** Known typos in class names (wrong -> correct) */
const CLASS_NAME_TYPOS: Record<string, string> = {
  Maintainance: "Maintenance",
  maintainance: "maintenance",
}

/** Class names that are LiveRC scheduling placeholders, not racing classes */
const PLACEHOLDER_CLASS_NAMES = ["track maintenance", "track maintainance"]

/**
 * Returns true if the class name is a known scheduling placeholder (e.g. Track Maintenance).
 * LiveRC uses these for time blocks between races, not actual races with drivers.
 */
export function isPlaceholderClass(className: string | null | undefined): boolean {
  if (className == null || typeof className !== "string") {
    return false
  }
  const normalized = className.trim().toLowerCase()
  return PLACEHOLDER_CLASS_NAMES.includes(normalized)
}

/**
 * Formats a class name for display, correcting known typos.
 *
 * @param className - Raw class name from API/database
 * @returns Formatted class name for display
 */
export function formatClassName(className: string | null | undefined): string {
  if (className == null || typeof className !== "string") {
    return ""
  }
  let formatted = className.trim()
  for (const [wrong, correct] of Object.entries(CLASS_NAME_TYPOS)) {
    formatted = formatted.replaceAll(wrong, correct)
  }
  return formatted
}
