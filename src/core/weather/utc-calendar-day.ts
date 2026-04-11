/**
 * Normalizes a Date to UTC midnight for the same UTC calendar day as the input.
 * Used for weather cache keys so per-day rows align with Open-Meteo day boundaries.
 */
export function utcCalendarDayStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}
