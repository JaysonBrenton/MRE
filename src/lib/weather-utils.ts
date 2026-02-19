/**
 * @fileoverview Weather UI utilities
 *
 * @description Shared helpers for weather display: user-friendly error messages
 * and condition-to-icon mapping. Used by Event Analysis WeatherCard and
 * dashboard DriverCardsAndWeatherGrid.
 *
 * @relatedFiles
 * - src/components/organisms/event-analysis/WeatherCard.tsx
 * - src/components/organisms/dashboard/DriverCardsAndWeatherGrid.tsx
 */

/**
 * Returns a user-friendly weather error message for display in the UI.
 * Matches the logic used in DriverCardsAndWeatherGrid WeatherErrorState.
 */
export function getWeatherErrorMessage(errorMsg: string): string {
  if (
    errorMsg.includes("Network error") ||
    errorMsg.includes("network connectivity") ||
    errorMsg.includes("Unable to reach")
  ) {
    return "Unable to load weather data - network connectivity issue"
  }
  if (errorMsg.includes("geocode") || errorMsg.includes("Geocoding")) {
    return "Weather data unavailable for this location"
  }
  if (errorMsg.includes("404") || errorMsg.includes("not found")) {
    return "Weather data not available"
  }
  if (errorMsg.includes("Failed to fetch") || errorMsg.includes("network")) {
    return "Unable to load weather data"
  }
  const firstSentence = errorMsg.split(".")[0]
  if (firstSentence.length > 100) {
    return "Weather data unavailable"
  }
  return firstSentence
}
