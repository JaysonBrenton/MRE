/**
 * @fileoverview Event status badge component
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Status tag/badge for event import status
 * 
 * @purpose Displays event status with color-coded badges. Accessible with
 *          text labels (not color-only indicators).
 * 
 * @relatedFiles
 * - src/components/event-search/EventRow.tsx (uses this component)
 */

export type EventStatus = "stored" | "imported" | "new" | "importing" | "failed"

export interface EventStatusBadgeProps {
  status: EventStatus
}

const statusConfig: Record<EventStatus, { label: string; bgColor: string; textColor: string }> = {
  stored: {
    label: "Stored",
    bgColor: "bg-green-900/30",
    textColor: "text-green-400",
  },
  imported: {
    label: "Imported",
    bgColor: "bg-green-900/30",
    textColor: "text-green-400",
  },
  new: {
    label: "New (LiveRC only)",
    bgColor: "bg-blue-900/30",
    textColor: "text-blue-400",
  },
  importing: {
    label: "Importing",
    bgColor: "bg-yellow-900/30",
    textColor: "text-yellow-400",
  },
  failed: {
    label: "Failed import",
    bgColor: "bg-red-900/30",
    textColor: "text-red-400",
  },
}

export default function EventStatusBadge({ status }: EventStatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${config.bgColor} ${config.textColor}`}
      aria-label={`Event status: ${config.label}`}
    >
      {config.label}
    </span>
  )
}

