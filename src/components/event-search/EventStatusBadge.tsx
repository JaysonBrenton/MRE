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

const statusConfig: Record<EventStatus, { label: string; description: string; bgColor: string; textColor: string }> = {
  stored: {
    label: "Stored",
    description: "Event data is stored and ready for analysis",
    bgColor: "bg-[var(--token-status-success-bg)]",
    textColor: "text-[var(--token-status-success-text)]",
  },
  imported: {
    label: "Ready",
    description: "Event has been fully imported with lap data",
    bgColor: "bg-[var(--token-status-success-bg)]",
    textColor: "text-[var(--token-status-success-text)]",
  },
  new: {
    label: "Not imported",
    description: "Event found on LiveRC but not yet imported into MRE",
    bgColor: "bg-[var(--token-status-info-bg)]",
    textColor: "text-[var(--token-status-info-text)]",
  },
  importing: {
    label: "Importing",
    description: "Event data is currently being imported from LiveRC",
    bgColor: "bg-[var(--token-status-warning-bg)]",
    textColor: "text-[var(--token-status-warning-text)]",
  },
  failed: {
    label: "Import failed",
    description: "Import failed - click Retry to try again",
    bgColor: "bg-[var(--token-status-error-bg)]",
    textColor: "text-[var(--token-status-error-text)]",
  },
}

export default function EventStatusBadge({ status }: EventStatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${config.bgColor} ${config.textColor}`}
      aria-label={`Event status: ${config.label}. ${config.description}`}
      title={config.description}
    >
      {config.label}
    </span>
  )
}
