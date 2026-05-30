/**
 * @fileoverview Collapsible glass card for Event / Session Level Analysis panels.
 */

"use client"

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react"
import {
  OVERVIEW_GLASS_SURFACE_CLASS,
  OVERVIEW_GLASS_SURFACE_STYLE,
} from "@/components/organisms/event-analysis/overview-glass-surface"
import { typography } from "@/lib/typography"

export interface OverviewCollapsibleGlassCardProps {
  panelId: string
  title: ReactNode
  /** Stable id for aria-labelledby on the outer section */
  headingId: string
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  children: ReactNode
  /** Placeholder / summary cards center content; data panels stretch */
  layout?: "stretch" | "center"
  className?: string
}

export default function OverviewCollapsibleGlassCard({
  panelId,
  title,
  headingId,
  expanded,
  onExpandedChange,
  children,
  layout = "stretch",
  className = "",
}: OverviewCollapsibleGlassCardProps) {
  const bodyId = useId()
  const contentRef = useRef<HTMLDivElement>(null)
  const [motionEnabled, setMotionEnabled] = useState(true)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setMotionEnabled(!mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])

  const syncMaxHeight = useCallback(() => {
    const el = contentRef.current
    if (!el) return
    if (expanded) {
      el.style.maxHeight = `${el.scrollHeight}px`
    } else {
      el.style.maxHeight = "0px"
    }
  }, [expanded])

  useEffect(() => {
    syncMaxHeight()
  }, [expanded, syncMaxHeight, children])

  useEffect(() => {
    const el = contentRef.current
    if (!el || !expanded) return
    const ro = new ResizeObserver(() => {
      el.style.maxHeight = `${el.scrollHeight}px`
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [expanded])

  const itemsClass = layout === "center" ? "items-center" : "items-stretch"
  const titleAlignClass =
    layout === "center"
      ? typography.overviewSectionCardTitle
      : typography.overviewEventResultsToolbarTitle
  const headerButtonClass =
    "flex min-w-0 flex-1 items-center gap-2 rounded-lg text-left transition-colors hover:bg-[var(--token-surface-raised)]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--token-interactive-focus-ring)] px-1 py-0.5 -mx-1"

  return (
    <section
      className={`flex min-h-0 min-w-0 flex-col ${itemsClass} gap-3 p-4 ${OVERVIEW_GLASS_SURFACE_CLASS} ${className}`}
      style={OVERVIEW_GLASS_SURFACE_STYLE}
      aria-labelledby={headingId}
      data-analysis-panel={panelId}
    >
      <div className="flex w-full min-w-0 items-center gap-2">
        <button
          type="button"
          className={headerButtonClass}
          aria-expanded={expanded}
          aria-controls={bodyId}
          onClick={() => onExpandedChange(!expanded)}
        >
          <svg
            className={`size-5 shrink-0 text-[var(--token-text-secondary)] transition-transform duration-200 ${
              expanded ? "rotate-90" : ""
            } ${motionEnabled ? "" : "transition-none"}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span
            id={headingId}
            className={`${titleAlignClass} ${layout === "center" ? "flex-1" : ""}`}
          >
            {title}
          </span>
        </button>
      </div>

      <div
        id={bodyId}
        ref={contentRef}
        className={`w-full min-w-0 overflow-hidden ${motionEnabled ? "transition-[max-height] duration-300 ease-in-out" : ""}`}
        style={{ maxHeight: expanded ? undefined : "0px" }}
        hidden={!expanded && !motionEnabled ? true : undefined}
      >
        <div className={`flex w-full min-w-0 flex-col ${itemsClass} gap-3`}>{children}</div>
      </div>
    </section>
  )
}
