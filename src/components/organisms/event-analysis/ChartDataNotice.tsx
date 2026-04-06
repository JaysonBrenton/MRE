/**
 * @fileoverview Chart data availability notice
 *
 * @created 2025-12-27
 * @creator Codex (AI Assistant)
 * @lastModified 2025-12-27
 *
 * @description When selected drivers lack telemetry required for a chart, this
 *              component records that fact in client app logs only. In-UI
 *              notices are intentionally not shown.
 *
 * @purpose Preserves observability for data gaps without cluttering the chart area.
 */

"use client"

import type { ReactNode } from "react"
import { useEffect, useRef } from "react"

import { clientLogger } from "@/lib/client-logger"

export interface ChartDataNoticeProps {
  title: string
  description: ReactNode
  driverNames: string[]
  className?: string
  onDismiss?: () => void
  eventId: string
  noticeType: string
}

function descriptionForLog(description: ReactNode): string {
  if (typeof description === "string") {
    return description
  }
  if (typeof description === "number" || typeof description === "boolean") {
    return String(description)
  }
  return "[non-text description]"
}

export default function ChartDataNotice({
  title,
  description,
  driverNames,
  eventId,
  noticeType,
}: ChartDataNoticeProps) {
  const lastSignatureRef = useRef<string | null>(null)

  useEffect(() => {
    if (driverNames.length === 0) {
      return
    }

    const descStr = descriptionForLog(description)
    const signature = `${eventId}\0${noticeType}\0${title}\0${descStr}\0${driverNames.join("|")}`
    if (lastSignatureRef.current === signature) {
      return
    }
    lastSignatureRef.current = signature

    clientLogger.info("Chart data notice (UI suppressed)", {
      eventId,
      noticeType,
      title,
      description: descStr,
      driverNames,
    })
  }, [description, driverNames, eventId, noticeType, title])

  return null
}
