/**
 * @fileoverview Practice Day Row component
 *
 * @created 2026-01-XX
 * @creator System
 * @lastModified 2026-01-XX
 *
 * @description Displays individual practice day in search results
 */

"use client"

import { format } from "date-fns"

export interface PracticeDayRowProps {
  date: string
  trackName: string
  sessionCount?: number
  totalLaps?: number
  uniqueDrivers?: number
  uniqueClasses?: number
  timeRangeStart?: string
  timeRangeEnd?: string
  isIngested?: boolean
  eventId?: string
  onIngest?: () => void
  onView?: () => void
}

export default function PracticeDayRow({
  date,
  trackName,
  sessionCount = 0,
  totalLaps = 0,
  uniqueDrivers = 0,
  uniqueClasses = 0,
  timeRangeStart,
  timeRangeEnd,
  isIngested = false,
  eventId,
  onIngest,
  onView,
}: PracticeDayRowProps) {
  const formattedDate = format(new Date(date), "MMM d, yyyy")
  const timeRange =
    timeRangeStart && timeRangeEnd
      ? `${format(new Date(timeRangeStart), "h:mm a")} - ${format(new Date(timeRangeEnd), "h:mm a")}`
      : null

  // Normalize numeric values to ensure they're always numbers
  // Handle all edge cases: undefined, null, NaN, or non-number types
  const safeSessionCount =
    typeof sessionCount === "number" && !isNaN(sessionCount) ? sessionCount : 0
  const safeTotalLaps = typeof totalLaps === "number" && !isNaN(totalLaps) ? totalLaps : 0
  const safeUniqueDrivers =
    typeof uniqueDrivers === "number" && !isNaN(uniqueDrivers) ? uniqueDrivers : 0
  const safeUniqueClasses =
    typeof uniqueClasses === "number" && !isNaN(uniqueClasses) ? uniqueClasses : 0

  return (
    <div className="border-b border-gray-700 py-4 px-4 hover:bg-gray-800/50 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-white">{formattedDate}</h3>
            <span className="text-sm text-gray-400">{trackName}</span>
            {isIngested && (
              <span className="px-2 py-1 text-xs bg-green-600/20 text-green-400 rounded">
                Ingested
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-300">
            <div>
              <span className="text-gray-500">Sessions:</span>{" "}
              <span className="font-medium">{safeSessionCount}</span>
            </div>
            <div>
              <span className="text-gray-500">Total Laps:</span>{" "}
              <span className="font-medium">
                {typeof safeTotalLaps === "number" ? safeTotalLaps.toLocaleString() : "0"}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Drivers:</span>{" "}
              <span className="font-medium">{safeUniqueDrivers}</span>
            </div>
            <div>
              <span className="text-gray-500">Classes:</span>{" "}
              <span className="font-medium">{safeUniqueClasses}</span>
            </div>
          </div>

          {timeRange && <div className="mt-2 text-xs text-gray-400">Time Range: {timeRange}</div>}
        </div>

        <div className="flex gap-2 ml-4">
          {isIngested && eventId && onView && (
            <button
              onClick={onView}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
            >
              View
            </button>
          )}
          {!isIngested && onIngest && (
            <button
              onClick={onIngest}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
            >
              Ingest
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
