/**
 * @fileoverview Chart colors hook - manages chart color state and localStorage persistence
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Custom hook for managing chart color customization with localStorage persistence
 *
 * @purpose Provides state management and persistence for chart color customization.
 *          Supports per-instance color storage with series-specific colors.
 *
 * @relatedFiles
 * - src/components/event-analysis/ChartColorPicker.tsx (color picker UI)
 * - src/components/event-analysis/ChartContainer.tsx (chart container)
 */

"use client"

import { useState, useEffect, useCallback } from "react"

export type SeriesName =
  | "primary"
  | "fastest"
  | "average"
  | "bestLap"
  | "averageLap"
  | "consistency"
  | "xAxis"
  | "yAxis"
  | "yAxisRight"

const STORAGE_PREFIX = "mre-chart-color"

/**
 * Get localStorage key for a chart color
 */
function getStorageKey(chartInstanceId: string, seriesName: SeriesName): string {
  return `${STORAGE_PREFIX}-${chartInstanceId}-${seriesName}`
}

/**
 * Read color from localStorage
 */
function readColorFromStorage(
  chartInstanceId: string,
  seriesName: SeriesName,
  defaultValue: string
): string {
  if (typeof window === "undefined") {
    return defaultValue
  }

  try {
    const stored = localStorage.getItem(getStorageKey(chartInstanceId, seriesName))
    if (stored) {
      // Validate hex color format
      if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(stored)) {
        return stored
      }
    }
  } catch (error) {
    // localStorage may not be available (private browsing, etc.)
    console.warn("Failed to read chart color from localStorage:", error)
  }

  return defaultValue
}

/**
 * Write color to localStorage
 */
function writeColorToStorage(chartInstanceId: string, seriesName: SeriesName, color: string): void {
  if (typeof window === "undefined") {
    return
  }

  try {
    // Validate hex color format before storing
    if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)) {
      localStorage.setItem(getStorageKey(chartInstanceId, seriesName), color)
    } else {
      console.warn("Invalid color format, not storing:", color)
    }
  } catch (error) {
    // localStorage may not be available (private browsing, etc.)
    console.warn("Failed to write chart color to localStorage:", error)
  }
}

/**
 * Hook for managing chart colors with localStorage persistence
 *
 * @param chartInstanceId - Unique identifier for the chart instance
 * @param seriesName - Name of the series (primary, fastest, average)
 * @param defaultValue - Default color to use if not stored
 * @returns [color, setColor] tuple
 */
export function useChartColor(
  chartInstanceId: string,
  seriesName: SeriesName,
  defaultValue: string
): [string, (color: string) => void] {
  const [color, setColorState] = useState<string>(() => {
    return readColorFromStorage(chartInstanceId, seriesName, defaultValue)
  })

  // Hydrate from localStorage only when chart instance or series changes (not when color
  // changes), so that user color picks are not overwritten by a re-run of this effect.
  useEffect(() => {
    const stored = readColorFromStorage(chartInstanceId, seriesName, defaultValue)
    setColorState(stored)
  }, [chartInstanceId, seriesName, defaultValue])

  const setColor = useCallback(
    (newColor: string) => {
      setColorState(newColor)
      writeColorToStorage(chartInstanceId, seriesName, newColor)
    },
    [chartInstanceId, seriesName]
  )

  return [color, setColor]
}

/**
 * Hook for managing multiple chart series colors
 *
 * @param chartInstanceId - Unique identifier for the chart instance
 * @param defaultColors - Object with default colors for each series
 * @returns Object with color state and setters for each series
 */
export function useChartColors<T extends Record<string, string>>(
  chartInstanceId: string,
  defaultColors: T
): {
  colors: T
  setColor: <K extends keyof T>(seriesName: K, color: string) => void
} {
  const [colors, setColorsState] = useState<T>(() => {
    const initial: Partial<T> = {}
    for (const [key, defaultValue] of Object.entries(defaultColors)) {
      initial[key as keyof T] = readColorFromStorage(
        chartInstanceId,
        key as SeriesName,
        defaultValue
      ) as T[keyof T]
    }
    return initial as T
  })

  const setColor = useCallback(
    <K extends keyof T>(seriesName: K, color: string) => {
      setColorsState((prev) => ({ ...prev, [seriesName]: color }))
      writeColorToStorage(chartInstanceId, seriesName as SeriesName, color)
    },
    [chartInstanceId]
  )

  return { colors, setColor }
}
