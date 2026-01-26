/**
 * @fileoverview Track map types and interfaces
 * 
 * @created 2026-01-24
 * @creator Auto-generated
 * @lastModified 2026-01-24
 * 
 * @description TypeScript types for track map data structures
 * 
 * @purpose Defines the shape data structure and related types for track maps
 * 
 * @relatedFiles
 * - src/core/track-maps/repo.ts (uses these types)
 * - src/core/track-maps/validation.ts (validates these types)
 */

export type TrackMapShapeType =
  | "straight"
  | "curve"
  | "chicane"
  | "sector"
  | "arrow"
  | "marker"
  | "custom"

export interface TrackMapShapeStyle {
  strokeColor: string
  fillColor?: string
  strokeWidth: number
  opacity?: number
}

export interface TrackMapShapeMeasurement {
  distance: number
  unit: "m" | "ft"
}

export interface TrackMapShape {
  id: string
  type: TrackMapShapeType
  coordinates: number[][] // Array of [x, y] points
  style: TrackMapShapeStyle
  label?: string
  measurement?: TrackMapShapeMeasurement
  metadata?: Record<string, unknown>
}

export interface TrackMapData {
  canvasWidth?: number
  canvasHeight?: number
  shapes: TrackMapShape[]
}

export interface CreateTrackMapParams {
  userId: string
  trackId: string
  name: string
  description?: string
  mapData: TrackMapData
  isPublic?: boolean
}

export interface UpdateTrackMapParams {
  name?: string
  description?: string
  mapData?: TrackMapData
  isPublic?: boolean
}

export interface TrackMapWithRelations {
  id: string
  userId: string
  trackId: string
  name: string
  description: string | null
  mapData: TrackMapData
  isPublic: boolean
  shareToken: string | null
  createdAt: Date
  updatedAt: Date
  track: {
    id: string
    trackName: string
  }
  user: {
    id: string
    driverName: string
  }
}
