/**
 * @fileoverview Event Analysis client component - handles client-side state
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @fix 2025-01-XX - Fixed class selection state update issue
 *
 * @description Client component for managing tab state and driver selection
 *
 * @purpose Separates client-side interactivity from server component.
 *          Manages tab navigation and driver selection state.
 *
 * @relatedFiles
 * - src/app/events/analyse/[eventId]/page.tsx (parent server component)
 */

"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import TabNavigation, { type TabId } from "@/components/event-analysis/TabNavigation"
import OverviewTab from "@/components/event-analysis/OverviewTab"
import DriversTab from "@/components/event-analysis/DriversTab"
import EntryListTab from "@/components/event-analysis/EntryListTab"
import SessionsTab from "@/components/event-analysis/SessionsTab"
import ComparisonsTab from "@/components/event-analysis/ComparisonsTab"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"

export interface EventAnalysisClientProps {
  initialData: EventAnalysisData
}

export default function EventAnalysisClient({ initialData }: EventAnalysisClientProps) {
  const [activeTab, setActiveTab] = useState<TabId>("overview")
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>([])
  const [selectedClass, setSelectedClass] = useState<string | null>(null)
  
  // Store setter in ref to ensure we always use the latest one
  const setSelectedClassRef = useRef(setSelectedClass)
  useEffect(() => {
    setSelectedClassRef.current = setSelectedClass
  }, [setSelectedClass])

  // Ensure selectedClass is never undefined
  const normalizedSelectedClass = selectedClass ?? null

  // Keep ref in sync with state for debugging
  useEffect(() => {
    console.log("[EventAnalysisClient] STATE CHANGED - selectedClass:", selectedClass)
    
    // If state is undefined, fix it
    if (selectedClass === undefined) {
      console.error("[EventAnalysisClient] ERROR: selectedClass is undefined! Fixing to null")
      setSelectedClass(null)
    }
  }, [selectedClass])

  // Callback that updates state - use ref to ensure we always call the latest setter
  const handleClassChangeBase = useCallback((className: string | null | undefined) => {
    console.log("[EventAnalysisClient] ====== handleClassChange CALLED ======")
    console.log("[EventAnalysisClient] FUNCTION_ID: REF_BASED_V18")
    console.log("[EventAnalysisClient] className parameter:", className)
    
    // Normalize the value
    const normalized = (className && typeof className === "string" && className.trim() !== "") 
      ? className.trim() 
      : null
    
    console.log("[EventAnalysisClient] Normalized value:", normalized)
    console.log("[EventAnalysisClient] About to call setSelectedClassRef.current...")
    
    // Use ref to call the latest setter - this ensures it always works
    setSelectedClassRef.current(normalized)
    
    console.log("[EventAnalysisClient] setSelectedClassRef.current called with:", normalized)
  }, []) // Empty deps - we use ref so we don't need setSelectedClass

  // Create wrapper function with metadata stored in a WeakMap to avoid modifying the function
  const callbackMetadata = useRef(new WeakMap<typeof handleClassChangeBase, { __CALLBACK_ID: string; __IS_OUR_FUNCTION: boolean }>())
  
  const handleClassChange = useMemo(() => {
    const wrapped = ((className: string | null | undefined) => {
      return handleClassChangeBase(className)
    }) as typeof handleClassChangeBase & {
      __CALLBACK_ID?: string
      __IS_OUR_FUNCTION?: boolean
    }
    // Store metadata in WeakMap instead of on the function
    callbackMetadata.current.set(handleClassChangeBase, {
      __CALLBACK_ID: "REF_BASED_V18",
      __IS_OUR_FUNCTION: true,
    })
    // For backward compatibility, also set on wrapper (but this is read-only access pattern)
    Object.defineProperty(wrapped, '__CALLBACK_ID', {
      value: "REF_BASED_V18",
      writable: false,
      configurable: true,
    })
    Object.defineProperty(wrapped, '__IS_OUR_FUNCTION', {
      value: true,
      writable: false,
      configurable: true,
    })
    return wrapped
  }, [handleClassChangeBase])

  const availableTabs = [
    { id: "overview" as TabId, label: "Event Overview" },
    { id: "sessions" as TabId, label: "Sessions / Heats" },
    { id: "comparisons" as TabId, label: "Comparisons" },
    { id: "entry-list" as TabId, label: "Entry List" },
    { id: "drivers" as TabId, label: "Drivers" },
  ]

  return (
    <div className="space-y-6">
      <TabNavigation tabs={availableTabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === "overview" && (() => {
        // Verify we're passing our function, not setSelectedClass
        console.log("[EventAnalysisClient] About to render OverviewTab")
        console.log("[EventAnalysisClient] handleClassChange:", handleClassChange)
        console.log("[EventAnalysisClient] handleClassChange.__CALLBACK_ID:", handleClassChange.__CALLBACK_ID)
        console.log("[EventAnalysisClient] handleClassChange === setSelectedClass?", handleClassChange === setSelectedClass)
        console.log("[EventAnalysisClient] handleClassChange.name:", handleClassChange.name)
        
        return (
          <OverviewTab
            key="overview-tab"
            data={initialData}
            selectedDriverIds={selectedDriverIds}
            onDriverSelectionChange={setSelectedDriverIds}
            selectedClass={normalizedSelectedClass}
            onClassChange={handleClassChange}
          />
        )
      })()}

      {activeTab === "drivers" && (
        <DriversTab
          data={initialData}
          selectedDriverIds={selectedDriverIds}
          onSelectionChange={setSelectedDriverIds}
        />
      )}

      {activeTab === "entry-list" && <EntryListTab data={initialData} />}

      {activeTab === "sessions" && (() => {
        console.log("[EventAnalysisClient] Rendering SessionsTab with selectedClass:", normalizedSelectedClass)
        return (
          <SessionsTab
            key={`sessions-${normalizedSelectedClass ?? "none"}`}
            data={initialData}
            selectedDriverIds={selectedDriverIds}
            selectedClass={normalizedSelectedClass}
          />
        )
      })()}

      {activeTab === "comparisons" && (
        <ComparisonsTab selectedClass={normalizedSelectedClass} />
      )}
    </div>
  )
}