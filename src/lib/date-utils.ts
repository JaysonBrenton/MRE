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
 * Format a time for display (e.g., "2:30 pm")
 * @param dateValue - ISO date string or Date object
 * @returns Formatted time string using Australian locale, or "Time not available" if invalid
 */
export function formatTimeDisplay(dateValue: string | Date | null | undefined): string {
  if (!dateValue) {
    return "Time not available"
  }

  const date = new Date(dateValue)

  if (isNaN(date.getTime())) {
    return "Time not available"
  }

  return date.toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
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
 * Normalize a date to noon UTC for that calendar day.
 * Use when returning date ranges from the server so the displayed calendar day
 * does not shift in the user's timezone (e.g. UTC midnight can become the
 * previous/next day in some timezones).
 *
 * @param date - Date or ISO string
 * @returns New Date with same UTC year/month/day at 12:00:00.000Z, or null if invalid
 */
export function toDateOnlyUTC(date: Date | string | null | undefined): Date | null {
  if (!date) {
    return null
  }
  const d = typeof date === "string" ? new Date(date) : date
  if (isNaN(d.getTime())) {
    return null
  }
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth()
  const day = d.getUTCDate()
  return new Date(Date.UTC(y, m, day, 12, 0, 0, 0))
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
 * @returns Formatted position improvement string, or "N/A" if positions are invalid
 */
export function formatPositionImprovement(
  first: number | null | undefined,
  last: number | null | undefined
): string {
  // Handle null/undefined values
  if (first == null || last == null) {
    return "N/A"
  }

  // Handle non-finite numbers (NaN, Infinity)
  if (!Number.isFinite(first) || !Number.isFinite(last)) {
    return "N/A"
  }

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
 * Check if an event date is in the future (after today)
 * @param dateString - ISO date string, Date object, or date string in various formats (DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY, etc.)
 * @returns true if the date is in the future, false otherwise
 */
export function isEventInFuture(dateString: string | Date | null | undefined): boolean {
  if (!dateString) {
    return false
  }

  // If it's already a Date object, use it directly
  if (dateString instanceof Date) {
    if (isNaN(dateString.getTime())) {
      return false
    }
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const eventDate = new Date(dateString)
    eventDate.setHours(0, 0, 0, 0)
    return eventDate > today
  }

  let eventDate: Date | null = null
  const dateStr = String(dateString).trim()

  // Try to parse the date string in various formats
  // 1. ISO format (YYYY-MM-DD) - most common from APIs - try this first
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    // ISO format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
    eventDate = new Date(dateStr)
    if (isNaN(eventDate.getTime())) {
      eventDate = null
    }
  }
  // 2. DD/MM/YYYY format (Australian format with slashes)
  else if (dateStr.includes("/") && !dateStr.includes("T")) {
    const parts = dateStr.split("/")
    if (parts.length === 3) {
      const part1 = parseInt(parts[0], 10)
      const part2 = parseInt(parts[1], 10)
      const part3 = parseInt(parts[2], 10)

      // Determine if it's DD/MM/YYYY or MM/DD/YYYY
      // If first part > 12, it's definitely DD/MM/YYYY
      // If second part > 12, it's definitely MM/DD/YYYY
      // Otherwise, assume DD/MM/YYYY (Australian format)
      if (part1 > 12 && part2 <= 12 && part3 > 1000) {
        // DD/MM/YYYY format
        eventDate = new Date(part3, part2 - 1, part1) // Year, Month (0-indexed), Day
      } else if (part2 > 12 && part1 <= 12 && part3 > 1000) {
        // MM/DD/YYYY format
        eventDate = new Date(part3, part1 - 1, part2)
      } else if (part3 > 1000) {
        // Assume DD/MM/YYYY (Australian format) if year is in third position
        eventDate = new Date(part3, part2 - 1, part1)
      }
    }
  }
  // 3. DD-MM-YYYY format (Australian format with dashes) - only if not ISO
  else if (
    dateStr.includes("-") &&
    dateStr.split("-").length === 3 &&
    !/^\d{4}-\d{2}-\d{2}/.test(dateStr)
  ) {
    const parts = dateStr.split("-")
    const part1 = parseInt(parts[0], 10)
    const part2 = parseInt(parts[1], 10)
    const part3 = parseInt(parts[2], 10)

    if (part3 > 1000) {
      // DD-MM-YYYY format
      eventDate = new Date(part3, part2 - 1, part1)
    }
  }

  // Fallback to standard Date parsing if we haven't parsed it yet
  // This handles edge cases and other formats
  if (!eventDate || isNaN(eventDate.getTime())) {
    eventDate = new Date(dateStr)
  }

  // Check if date is valid
  if (isNaN(eventDate.getTime())) {
    return false
  }

  // Normalize both dates to start of day (midnight) for accurate comparison
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  eventDate.setHours(0, 0, 0, 0)

  // Event is in the future if its date is after today
  return eventDate > today
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
