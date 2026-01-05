/**
 * @fileoverview Date formatting utilities with localization support
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Provides consistent date formatting across the application
 *              with support for Australian date format (dd-MM-YYYY)
 */

/**
 * Format a date string for display in Australian format (dd-MM-YYYY)
 * @param dateString - ISO date string or date object
 * @returns Formatted date string (e.g., "13-12-2025")
 */
export function formatDateDisplay(dateString: string | null | undefined): string {
  if (!dateString) {
    return "Date not available"
  }

  const date = new Date(dateString)

  // Check if date is valid
  if (isNaN(date.getTime())) {
    return "Invalid date"
  }

  // Format as dd-MM-YYYY
  const day = date.getDate().toString().padStart(2, "0")
  const month = (date.getMonth() + 1).toString().padStart(2, "0")
  const year = date.getFullYear()

  return `${day}-${month}-${year}`
}

/**
 * Format a date string for long display (e.g., "13 December 2025")
 * @param dateValue - ISO date string or Date object
 * @returns Formatted date string
 */
export function formatDateLong(dateValue: string | Date | null | undefined): string {
  if (!dateValue) {
    return "Date not available"
  }

  const date = new Date(dateValue)

  // Check if date is valid
  if (isNaN(date.getTime())) {
    return "Invalid date"
  }

  // Use Australian locale for long format
  return date.toLocaleDateString("en-AU", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

/**
 * Format a date for input field (YYYY-MM-DD)
 * @param dateString - ISO date string or date object
 * @returns Formatted date string for HTML date input
 */
export function formatDateForInput(dateString: string | null | undefined): string {
  if (!dateString) {
    return ""
  }

  const date = new Date(dateString)

  if (isNaN(date.getTime())) {
    return ""
  }

  return date.toISOString().split("T")[0]
}

/**
 * Format lap time in seconds to MM:SS.mmm format
 * @param lapTimeSeconds - Lap time in seconds (e.g., 45.123)
 * @returns Formatted lap time string (e.g., "00:45.123") or "N/A" if invalid
 */
export function formatLapTime(lapTimeSeconds: number | null | undefined): string {
  if (lapTimeSeconds === null || lapTimeSeconds === undefined) {
    return "N/A"
  }

  if (!Number.isFinite(lapTimeSeconds) || lapTimeSeconds < 0) {
    return "N/A"
  }

  const totalSeconds = Math.floor(lapTimeSeconds)
  const milliseconds = Math.floor((lapTimeSeconds - totalSeconds) * 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${milliseconds.toString().padStart(3, "0")}`
}

/**
 * Format position improvement for display (e.g., "15th → 3rd (+12)")
 * @param first - First race position
 * @param last - Last race position
 * @returns Formatted position improvement string
 */
export function formatPositionImprovement(first: number, last: number): string {
  const improvement = first - last
  const firstSuffix = getOrdinalSuffix(first)
  const lastSuffix = getOrdinalSuffix(last)

  if (improvement > 0) {
    return `${first}${firstSuffix} → ${last}${lastSuffix} (+${improvement})`
  } else if (improvement < 0) {
    return `${first}${firstSuffix} → ${last}${lastSuffix} (${improvement})`
  } else {
    return `${first}${firstSuffix} → ${last}${lastSuffix}`
  }
}

/**
 * Format lap time improvement for display (e.g., "-2.3s")
 * @param improvement - Lap time improvement in seconds (positive = improved/faster)
 * @returns Formatted lap time improvement string
 */
export function formatLapTimeImprovement(improvement: number | null): string {
  if (improvement === null || improvement === undefined) {
    return "N/A"
  }

  if (!Number.isFinite(improvement)) {
    return "N/A"
  }

  if (improvement > 0) {
    return `-${improvement.toFixed(2)}s`
  } else if (improvement < 0) {
    return `+${Math.abs(improvement).toFixed(2)}s`
  } else {
    return "0.00s"
  }
}

/**
 * Get ordinal suffix for a number (1st, 2nd, 3rd, 4th, etc.)
 * @param num - Number
 * @returns Ordinal suffix string
 */
function getOrdinalSuffix(num: number): string {
  const j = num % 10
  const k = num % 100
  if (j === 1 && k !== 11) {
    return "st"
  }
  if (j === 2 && k !== 12) {
    return "nd"
  }
  if (j === 3 && k !== 13) {
    return "rd"
  }
  return "th"
}
