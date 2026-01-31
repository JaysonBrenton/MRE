/**
 * @fileoverview Formatting utilities for session data display
 *
 * @created 2025-01-07
 * @creator System
 * @lastModified 2025-01-07
 *
 * @description Utility functions for formatting session data (durations, lap times, dates)
 *
 * @purpose Provides consistent formatting for session tables and charts
 *
 * @relatedFiles
 * - src/components/event-analysis/sessions/SessionsTable.tsx
 */

/**
 * Format duration in seconds to MM:SS format
 * @param seconds - Duration in seconds
 * @returns Formatted string (e.g., "5:30")
 */
export function formatDuration(seconds: number | null): string {
  if (seconds === null) {
    return "—"
  }

  const minutes = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${minutes}:${secs.toString().padStart(2, "0")}`
}

/**
 * Format lap time in seconds to MM:SS.mmm format
 * @param seconds - Lap time in seconds
 * @returns Formatted string (e.g., "0:35.500", "1:23.456")
 */
export function formatLapTime(seconds: number | null): string {
  if (seconds === null) {
    return "—"
  }

  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  const wholeSecs = Math.floor(secs)
  const millis = Math.floor((secs - wholeSecs) * 1000)
  return `${minutes}:${wholeSecs.toString().padStart(2, "0")}.${millis.toString().padStart(3, "0")}`
}

/**
 * Format date/time to readable format
 * @param date - Date object or null
 * @returns Formatted string (e.g., "Jan 7, 2025 10:30 AM")
 */
export function formatDateTime(date: Date | null): string {
  if (date === null) {
    return "—"
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date)
}

/**
 * Format time only (no date)
 * @param date - Date object or null
 * @returns Formatted string (e.g., "10:30 AM")
 */
export function formatTime(date: Date | null): string {
  if (date === null) {
    return "—"
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date)
}

/**
 * Format total race time in seconds to HH:MM:SS format
 * @param seconds - Total time in seconds
 * @returns Formatted string (e.g., "0:05:30", "1:23:45")
 */
export function formatTotalTime(seconds: number | null): string {
  if (seconds === null) {
    return "—"
  }

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  return `${minutes}:${secs.toString().padStart(2, "0")}`
}

/**
 * Format consistency percentage
 * @param consistency - Consistency value (0-100, already a percentage)
 * @returns Formatted string (e.g., "95.5%")
 */
export function formatConsistency(consistency: number | null): string {
  if (consistency === null) {
    return "—"
  }

  return `${consistency.toFixed(1)}%`
}
