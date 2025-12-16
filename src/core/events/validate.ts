/**
 * @fileoverview Event validation functions
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Validation logic for event search parameters
 * 
 * @purpose Provides validation for event search operations, including date range
 *          validation (max 3 months, no future dates). This validation is
 *          framework-agnostic and can be used by API routes, server actions, or
 *          mobile clients.
 * 
 * @relatedFiles
 * - src/core/events/search-events.ts (uses this validation)
 */

export interface ValidationError {
  code: string
  message: string
  field?: string
}

const MAX_DATE_RANGE_DAYS = 90 // 3 months
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Validate event search parameters
 * 
 * @param trackId - Track ID (required)
 * @param startDate - Start date string (ISO format, optional)
 * @param endDate - End date string (ISO format, optional)
 * @returns Validation error or null if valid
 */
export function validateEventSearchParams(
  trackId: string | null,
  startDate: string | null,
  endDate: string | null
): ValidationError | null {
  if (!trackId) {
    return {
      code: "VALIDATION_ERROR",
      message: "track_id is required",
      field: "track_id",
    }
  }

  // Dates are optional - only validate if provided
  // If one date is provided, both should be provided
  const hasStartDate = startDate && startDate.trim() !== ""
  const hasEndDate = endDate && endDate.trim() !== ""

  if (hasStartDate && !hasEndDate) {
    return {
      code: "VALIDATION_ERROR",
      message: "end_date is required when start_date is provided",
      field: "end_date",
    }
  }

  if (hasEndDate && !hasStartDate) {
    return {
      code: "VALIDATION_ERROR",
      message: "start_date is required when end_date is provided",
      field: "start_date",
    }
  }

  // If both dates are provided, validate them
  if (hasStartDate && hasEndDate) {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const today = new Date()
    
    // Normalize all dates to start of day (midnight) for consistent comparison
    // This ensures timezone and time component differences don't affect validation
    start.setHours(0, 0, 0, 0)
    end.setHours(0, 0, 0, 0)
    today.setHours(0, 0, 0, 0)

    // Validate date format
    if (isNaN(start.getTime())) {
      return {
        code: "VALIDATION_ERROR",
        message: "start_date must be a valid date",
        field: "start_date",
      }
    }

    if (isNaN(end.getTime())) {
      return {
        code: "VALIDATION_ERROR",
        message: "end_date must be a valid date",
        field: "end_date",
      }
    }

    // Validate start <= end
    if (start > end) {
      return {
        code: "VALIDATION_ERROR",
        message: "start_date must be before or equal to end_date",
        field: "start_date",
      }
    }

    // Validate no future dates (using >= to allow today)
    if (start > today || end > today) {
      return {
        code: "VALIDATION_ERROR",
        message: "Cannot select future dates. Please select today or earlier.",
        field: end > today ? "end_date" : "start_date",
      }
    }

    // Validate max date range (3 months)
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / MILLISECONDS_PER_DAY)
    if (daysDiff > MAX_DATE_RANGE_DAYS) {
      return {
        code: "VALIDATION_ERROR",
        message: `Date range cannot exceed ${MAX_DATE_RANGE_DAYS} days (3 months). Please select a shorter range.`,
        field: "end_date",
      }
    }
  }

  return null
}

