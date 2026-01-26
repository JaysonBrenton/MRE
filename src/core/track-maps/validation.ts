/**
 * @fileoverview Track map data validation
 * 
 * @created 2026-01-24
 * @creator Auto-generated
 * @lastModified 2026-01-24
 * 
 * @description Validation functions for track map data structures
 * 
 * @purpose Ensures track map data is valid before saving to database
 * 
 * @relatedFiles
 * - src/core/track-maps/types.ts (validates these types)
 * - src/core/track-maps/repo.ts (uses validation)
 */

import type {
  TrackMapData,
  TrackMapShape,
  TrackMapShapeType,
} from "./types"

const VALID_SHAPE_TYPES: TrackMapShapeType[] = [
  "straight",
  "curve",
  "chicane",
  "sector",
  "arrow",
  "marker",
  "custom",
]

/**
 * Validate a track map shape
 */
export function validateTrackMapShape(shape: unknown): shape is TrackMapShape {
  if (typeof shape !== "object" || shape === null) {
    return false
  }

  const s = shape as Record<string, unknown>

  // Check required fields
  if (typeof s.id !== "string" || s.id.length === 0) {
    return false
  }

  if (
    typeof s.type !== "string" ||
    !VALID_SHAPE_TYPES.includes(s.type as TrackMapShapeType)
  ) {
    return false
  }

  // Check coordinates
  if (!Array.isArray(s.coordinates)) {
    return false
  }

  for (const coord of s.coordinates) {
    if (!Array.isArray(coord) || coord.length !== 2) {
      return false
    }
    if (typeof coord[0] !== "number" || typeof coord[1] !== "number") {
      return false
    }
  }

  // Check style
  if (typeof s.style !== "object" || s.style === null) {
    return false
  }

  const style = s.style as Record<string, unknown>
  if (typeof style.strokeColor !== "string") {
    return false
  }
  if (typeof style.strokeWidth !== "number" || style.strokeWidth < 0) {
    return false
  }
  if (style.fillColor !== undefined && typeof style.fillColor !== "string") {
    return false
  }
  if (style.opacity !== undefined && typeof style.opacity !== "number") {
    return false
  }

  // Check optional fields
  if (s.label !== undefined && typeof s.label !== "string") {
    return false
  }

  if (s.measurement !== undefined) {
    const measurement = s.measurement as Record<string, unknown>
    if (typeof measurement.distance !== "number" || measurement.distance < 0) {
      return false
    }
    if (measurement.unit !== "m" && measurement.unit !== "ft") {
      return false
    }
  }

  return true
}

/**
 * Validate track map data
 */
export function validateTrackMapData(data: unknown): data is TrackMapData {
  if (typeof data !== "object" || data === null) {
    return false
  }

  const d = data as Record<string, unknown>

  // Check optional canvas dimensions
  if (d.canvasWidth !== undefined && typeof d.canvasWidth !== "number") {
    return false
  }
  if (d.canvasHeight !== undefined && typeof d.canvasHeight !== "number") {
    return false
  }

  // Check shapes array
  if (!Array.isArray(d.shapes)) {
    return false
  }

  // Validate each shape
  for (const shape of d.shapes) {
    if (!validateTrackMapShape(shape)) {
      return false
    }
  }

  return true
}
