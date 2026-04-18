/**
 * @fileoverview Session (race class) and vehicle type filters for event-results tables
 *
 * @description Labeled Session / Type selects (same control chrome as `SessionRaceResultsTable`).
 * Race class and mapped taxonomy filters are mutually exclusive. Type is disabled when no
 * taxonomy targets exist on the event, with a tooltip pointing users to Car taxonomy.
 */

"use client"

import { useId } from "react"
import Tooltip from "@/components/molecules/Tooltip"

export interface EventAnalysisTaxonomyScopeOption {
  taxonomyNodeId: string
  label: string
}

export interface EventAnalysisScopeFiltersProps {
  validClasses: string[]
  eventClassFilter: string | null
  eventTaxonomyNodeFilter: string | null
  taxonomyOptions: EventAnalysisTaxonomyScopeOption[]
  onClassFilterChange: (className: string | null) => void
  onTaxonomyFilterChange: (taxonomyNodeId: string | null) => void
}

/** Matches `SessionRaceResultsTable` session / driver control styling. */
const SELECT_CLASS =
  "max-w-[min(100%,22rem)] rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] px-2 py-1 text-xs text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed"

const LABEL_CLASS = "text-xs font-medium text-[var(--token-text-secondary)]"

export default function EventAnalysisScopeFilters({
  validClasses,
  eventClassFilter,
  eventTaxonomyNodeFilter,
  taxonomyOptions,
  onClassFilterChange,
  onTaxonomyFilterChange,
}: EventAnalysisScopeFiltersProps) {
  const sessionFieldId = useId()
  const typeFieldId = useId()
  const taxonomyDisabled = taxonomyOptions.length === 0
  const sessionDisabledByType = eventTaxonomyNodeFilter != null
  const sessionControlDisabled = sessionDisabledByType || validClasses.length === 0
  const classValue = eventClassFilter ?? ""
  const taxonomyValue = eventTaxonomyNodeFilter ?? ""

  const sessionSelect = (
    <select
      id={sessionFieldId}
      className={SELECT_CLASS}
      disabled={sessionControlDisabled}
      value={classValue}
      aria-label="Filter by LiveRC race class"
      onChange={(e) => {
        const v = e.target.value
        onClassFilterChange(v === "" ? null : v)
      }}
    >
      <option value="">All race classes</option>
      {validClasses.map((cn) => (
        <option key={cn} value={cn}>
          {cn}
        </option>
      ))}
    </select>
  )

  const typeSelect = (
    <select
      id={typeFieldId}
      className={SELECT_CLASS}
      disabled={taxonomyDisabled}
      value={taxonomyValue}
      aria-label="Filter by mapped vehicle type"
      onChange={(e) => {
        const v = e.target.value
        onTaxonomyFilterChange(v === "" ? null : v)
      }}
    >
      <option value="">All vehicle types</option>
      {taxonomyOptions.map((opt) => (
        <option key={opt.taxonomyNodeId} value={opt.taxonomyNodeId}>
          {opt.label}
        </option>
      ))}
    </select>
  )

  const sessionTooltip = "Clear the vehicle type filter to choose a session by race class."

  const taxonomyTooltip =
    "No vehicle types are mapped for this event yet. Open Car taxonomy to map LiveRC classes to vehicle types, then return here to filter by type."

  return (
    <>
      {validClasses.length > 0 && (
        <div className="flex items-center gap-2">
          <label htmlFor={sessionFieldId} className={LABEL_CLASS}>
            Session
          </label>
          {sessionDisabledByType ? (
            <Tooltip text={sessionTooltip} position="top">
              <span className="inline-flex cursor-not-allowed">{sessionSelect}</span>
            </Tooltip>
          ) : (
            sessionSelect
          )}
        </div>
      )}
      <div className="flex items-center gap-2">
        <label htmlFor={typeFieldId} className={LABEL_CLASS}>
          Type
        </label>
        {taxonomyDisabled ? (
          <Tooltip text={taxonomyTooltip} position="top">
            <span className="inline-flex cursor-not-allowed">{typeSelect}</span>
          </Tooltip>
        ) : (
          typeSelect
        )}
      </div>
    </>
  )
}
