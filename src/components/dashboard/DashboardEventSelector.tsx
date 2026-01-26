/**
 * @fileoverview Dashboard event selector - handles eventId query parameter
 * 
 * @created 2025-01-28
 * @creator Auto-generated
 * @lastModified 2025-01-28
 * 
 * @description Client component that reads eventId from query params and selects it in Redux
 * 
 * @purpose When navigating to dashboard with ?eventId=xxx, automatically selects that event
 *          so the EventAnalysisSection displays the analysis for that event.
 * 
 * @relatedFiles
 * - src/app/(authenticated)/dashboard/page.tsx (uses this)
 * - src/store/slices/dashboardSlice.ts (Redux actions)
 */

"use client"

import { useEffect } from "react"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { selectEvent } from "@/store/slices/dashboardSlice"
import { useRouter, usePathname } from "next/navigation"

interface DashboardEventSelectorProps {
  eventId: string | null
}

export default function DashboardEventSelector({ eventId }: DashboardEventSelectorProps) {
  const dispatch = useAppDispatch()
  const selectedEventId = useAppSelector((state) => state.dashboard.selectedEventId)
  const router = useRouter()
  const pathname = usePathname()

  // Auto-select event from query parameter
  useEffect(() => {
    if (eventId && eventId !== selectedEventId) {
      dispatch(selectEvent(eventId))
    }
    // Note: We don't clear selectedEventId when eventId param is removed
    // to preserve the user's selection if they navigate away from the query param
  }, [eventId, selectedEventId, dispatch])

  // Clean up query parameter after selecting (optional - keeps URL clean)
  useEffect(() => {
    if (eventId && eventId === selectedEventId && typeof window !== "undefined") {
      // Remove eventId from URL after selection to keep URL clean
      const url = new URL(window.location.href)
      if (url.searchParams.has("eventId")) {
        url.searchParams.delete("eventId")
        const newUrl = url.pathname + (url.search ? url.search : "")
        router.replace(newUrl, { scroll: false })
      }
    }
  }, [eventId, selectedEventId, router, pathname])

  return null // This component doesn't render anything
}
