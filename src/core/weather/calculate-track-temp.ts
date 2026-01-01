/**
 * @fileoverview Track temperature calculation utility
 * 
 * @created 2025-01-27
 * @creator Auto (AI Assistant)
 * @lastModified 2025-01-27
 * 
 * @description Calculates estimated track surface temperature from air temperature
 * 
 * @purpose Provides a formula-based estimation of track temperature, which is
 *          not directly available from most weather APIs. The calculation uses
 *          a multiplier approach with optional solar radiation adjustments.
 */

/**
 * Calculates estimated track surface temperature from air temperature
 * 
 * Track temperature is typically higher than air temperature due to:
 * - Solar radiation absorption by the track surface
 * - Heat retention in the track material
 * - Lack of air circulation at ground level
 * 
 * @param airTemp - Air temperature in Celsius
 * @param hourOfDay - Optional hour of day (0-23) for solar radiation adjustment
 * @returns Estimated track temperature in Celsius
 */
export function calculateTrackTemperature(airTemp: number, hourOfDay?: number): number {
  // Base multiplier: track is typically 1.2x air temperature
  let trackTemp = airTemp * 1.2

  // Solar radiation adjustment based on time of day
  if (hourOfDay !== undefined) {
    // Peak solar radiation around noon (12:00)
    // Scale from 0 (midnight) to 1 (noon) to 0 (midnight)
    const solarFactor = Math.cos((hourOfDay - 12) * (Math.PI / 12))
    const normalizedSolarFactor = (solarFactor + 1) / 2 // Normalize to 0-1
    
    // Add up to 5°C additional heat during peak solar hours
    const solarAdjustment = normalizedSolarFactor * 5
    trackTemp += solarAdjustment
  }

  // Clamp: track temp should never be below air temp
  trackTemp = Math.max(trackTemp, airTemp)
  
  // Clamp: reasonable maximum (e.g., 70°C for extreme conditions)
  const maxReasonableTemp = 70
  trackTemp = Math.min(trackTemp, maxReasonableTemp)

  // Round to 1 decimal place
  return Math.round(trackTemp * 10) / 10
}

