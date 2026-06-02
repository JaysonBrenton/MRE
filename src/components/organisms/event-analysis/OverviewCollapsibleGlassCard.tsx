/**
 * @fileoverview Collapsible glass card for Event / Session Level Analysis panels.
 *
 * @description Header + body card on the shared glass surface. Two collapse modes:
 *  - Simple (default): body animates max-height to 0 when collapsed (placeholders).
 *  - Animated height (`animatedHeight`): the card stays a fixed-height tile when
 *    collapsed and animates a wrapper height on toggle. The body receives a
 *    render `tier` ("mini" | "full") that flips ONCE, after the height
 *    transition finishes, so heavy chart children re-render a single time at
 *    their new size instead of re-measuring continuously mid-animation.
 *
 * @relatedFiles
 * - docs/implimentation_plans/analysis-card-collapse-mini-chart-2026-05.md (§5 engine)
 * - src/components/organisms/event-analysis/OverviewTab.tsx (consumer)
 */

"use client"

import { GripVertical } from "lucide-react"
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react"
import {
  ANALYSIS_TILE_COLLAPSED_HEIGHT_PX,
  OVERVIEW_GLASS_SURFACE_CLASS,
  OVERVIEW_GLASS_SURFACE_STYLE,
} from "@/components/organisms/event-analysis/overview-glass-surface"
import { typography } from "@/lib/typography"
import type { AnalysisPanelDragHandle } from "@/components/organisms/event-analysis/AnalysisPanelSortableGrid"

export type AnalysisCardTier = "mini" | "full"

type CardChildren = ReactNode | ((ctx: { tier: AnalysisCardTier; expanded: boolean }) => ReactNode)

export interface OverviewCollapsibleGlassCardProps {
  panelId: string
  title: ReactNode
  /** Stable id for aria-labelledby on the outer section. */
  headingId: string
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  /**
   * When true, use the height-transition engine (fixed-height collapsed tile,
   * animated wrapper, single tier swap on transition end). Children should be a
   * render-prop that reads `tier` to render compact vs full.
   */
  animatedHeight?: boolean
  /** Collapsed tile height (px). Default {@link ANALYSIS_TILE_COLLAPSED_HEIGHT_PX}. */
  collapsedHeightPx?: number
  /**
   * Expanded body height (px) used as the animation target. When omitted the
   * card measures the natural content height and settles to `auto`.
   */
  expandedHeightPx?: number
  /** Body content, or a render-prop receiving the current tier. */
  children: CardChildren
  className?: string
  /** When set, shows a grip handle for drag-and-drop panel reordering. */
  dragHandle?: AnalysisPanelDragHandle
}

const TRANSITION_MS = 280

export default function OverviewCollapsibleGlassCard({
  panelId,
  title,
  headingId,
  expanded,
  onExpandedChange,
  animatedHeight = false,
  collapsedHeightPx = ANALYSIS_TILE_COLLAPSED_HEIGHT_PX,
  expandedHeightPx,
  children,
  className = "",
  dragHandle,
}: OverviewCollapsibleGlassCardProps) {
  const bodyId = useId()
  const [motionEnabled, setMotionEnabled] = useState(true)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setMotionEnabled(!mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])

  const renderBody = (tier: AnalysisCardTier): ReactNode =>
    typeof children === "function" ? children({ tier, expanded }) : children

  const header = (
    <div className="flex w-full min-w-0 items-center gap-1">
      {dragHandle ? (
        dragHandle.disabled ? (
          <span
            className="shrink-0 rounded p-0.5 text-[var(--token-text-muted)] opacity-30"
            aria-hidden
          >
            <GripVertical className="size-4" />
          </span>
        ) : (
          <button
            type="button"
            className="shrink-0 touch-none cursor-grab rounded p-0.5 text-[var(--token-text-muted)] transition-colors hover:bg-[var(--token-surface-raised)]/40 hover:text-[var(--token-text-secondary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--token-interactive-focus-ring)] active:cursor-grabbing"
            aria-label="Drag to reorder panel"
            {...dragHandle.attributes}
            {...dragHandle.listeners}
          >
            <GripVertical className="size-4" aria-hidden />
          </button>
        )
      ) : null}
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--token-interactive-focus-ring)]"
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
          className={`${typography.overviewEventResultsToolbarTitle} transition-colors hover:text-[var(--token-text-primary)]`}
        >
          {title}
        </span>
      </button>
    </div>
  )

  if (animatedHeight) {
    return (
      <AnimatedHeightCard
        panelId={panelId}
        headingId={headingId}
        bodyId={bodyId}
        header={header}
        className={className}
        expanded={expanded}
        motionEnabled={motionEnabled}
        collapsedHeightPx={collapsedHeightPx}
        expandedHeightPx={expandedHeightPx}
        renderBody={renderBody}
      />
    )
  }

  // Simple max-height collapse (placeholders / non-animated cards).
  return (
    <section
      className={`flex min-h-0 min-w-0 flex-col items-stretch gap-3 p-4 ${OVERVIEW_GLASS_SURFACE_CLASS} ${className}`}
      style={OVERVIEW_GLASS_SURFACE_STYLE}
      aria-labelledby={headingId}
      data-analysis-panel={panelId}
    >
      {header}
      <SimpleCollapseBody bodyId={bodyId} expanded={expanded} motionEnabled={motionEnabled}>
        {renderBody(expanded ? "full" : "mini")}
      </SimpleCollapseBody>
    </section>
  )
}

function SimpleCollapseBody({
  bodyId,
  expanded,
  motionEnabled,
  children,
}: {
  bodyId: string
  expanded: boolean
  motionEnabled: boolean
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.maxHeight = expanded ? `${el.scrollHeight}px` : "0px"
  }, [expanded, children])

  useEffect(() => {
    const el = ref.current
    if (!el || !expanded) return
    const ro = new ResizeObserver(() => {
      el.style.maxHeight = `${el.scrollHeight}px`
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [expanded])

  return (
    <div
      id={bodyId}
      ref={ref}
      className={`w-full min-w-0 overflow-hidden ${motionEnabled ? "transition-[max-height] duration-300 ease-in-out" : ""}`}
      style={{ maxHeight: expanded ? undefined : "0px" }}
      hidden={!expanded && !motionEnabled ? true : undefined}
    >
      <div className="flex w-full min-w-0 flex-col items-stretch gap-3">{children}</div>
    </div>
  )
}

/**
 * Height-transition engine (plan §5): animate a wrapper height while the chart
 * keeps its current render size, then swap the tier exactly once on
 * `transitionend` so the chart re-renders a single time at the final size.
 */
function AnimatedHeightCard({
  panelId,
  headingId,
  bodyId,
  header,
  className,
  expanded,
  motionEnabled,
  collapsedHeightPx,
  expandedHeightPx,
  renderBody,
}: {
  panelId: string
  headingId: string
  bodyId: string
  header: ReactNode
  className: string
  expanded: boolean
  motionEnabled: boolean
  collapsedHeightPx: number
  expandedHeightPx?: number
  renderBody: (tier: AnalysisCardTier) => ReactNode
}) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const tokenRef = useRef(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** What size the body currently renders at (lags `expanded` during animation). */
  const [renderTier, setRenderTier] = useState<AnalysisCardTier>(expanded ? "full" : "mini")
  const [phase, setPhase] = useState<"idle" | "animating">("idle")
  /** Controlled wrapper height; null = auto (natural, expanded + idle). */
  const [wrapperHeight, setWrapperHeight] = useState<number | null>(
    expanded ? null : collapsedHeightPx
  )
  const [fading, setFading] = useState(false)
  /** Skip the very first effect run so initial mount doesn't animate. */
  const mountedRef = useRef(false)

  const measureExpandedTarget = useCallback(() => {
    if (expandedHeightPx != null) return expandedHeightPx
    return innerRef.current?.scrollHeight ?? collapsedHeightPx
  }, [expandedHeightPx, collapsedHeightPx])

  const clearPendingTimeout = () => {
    if (timeoutRef.current != null) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }

  useEffect(() => {
    // First run: align state to the initial `expanded` without animating.
    if (!mountedRef.current) {
      mountedRef.current = true
      setRenderTier(expanded ? "full" : "mini")
      setWrapperHeight(expanded ? null : collapsedHeightPx)
      return
    }

    const token = ++tokenRef.current
    clearPendingTimeout()

    if (!motionEnabled) {
      setRenderTier(expanded ? "full" : "mini")
      setWrapperHeight(expanded ? null : collapsedHeightPx)
      setPhase("idle")
      setFading(false)
      return
    }

    const wrapperEl = wrapperRef.current
    const fromH = wrapperEl?.getBoundingClientRect().height ?? collapsedHeightPx
    const toH = expanded ? measureExpandedTarget() : collapsedHeightPx

    // Phase 1: pin the start height, keep current tier (no chart re-measure yet).
    setPhase("animating")
    setFading(true)
    setWrapperHeight(fromH)

    // Force reflow so the browser commits fromH before transitioning.
    if (wrapperEl) void wrapperEl.offsetHeight

    // Phase 2: next frame, animate toward the target height.
    const raf = requestAnimationFrame(() => {
      if (tokenRef.current !== token) return
      setWrapperHeight(toH)
    })

    // Phase 3: on completion, swap tier once and settle.
    const settle = () => {
      if (tokenRef.current !== token) return
      clearPendingTimeout()
      setRenderTier(expanded ? "full" : "mini")
      setWrapperHeight(expanded ? null : collapsedHeightPx)
      setPhase("idle")
      setFading(false)
    }

    const el = wrapperRef.current
    const onEnd = (e: TransitionEvent) => {
      if (e.target !== el || e.propertyName !== "height") return
      el?.removeEventListener("transitionend", onEnd)
      settle()
    }
    el?.addEventListener("transitionend", onEnd)
    // Fallback if transitionend doesn't fire (e.g. height unchanged).
    timeoutRef.current = setTimeout(() => {
      el?.removeEventListener("transitionend", onEnd)
      settle()
    }, TRANSITION_MS + 80)

    return () => {
      cancelAnimationFrame(raf)
      el?.removeEventListener("transitionend", onEnd)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, motionEnabled])

  // When expanded + idle, keep height auto but re-pin if inner content reflows.
  useEffect(() => {
    if (phase !== "idle" || !expanded) return
    const el = innerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      // height stays auto; observer only guards against clipped content.
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [phase, expanded])

  useEffect(() => clearPendingTimeout, [])

  const heightStyle = wrapperHeight == null ? undefined : `${wrapperHeight}px`

  return (
    <section
      className={`flex min-h-0 min-w-0 flex-col items-stretch gap-3 p-4 ${OVERVIEW_GLASS_SURFACE_CLASS} ${className}`}
      style={OVERVIEW_GLASS_SURFACE_STYLE}
      aria-labelledby={headingId}
      data-analysis-panel={panelId}
    >
      {header}
      <div
        id={bodyId}
        ref={wrapperRef}
        className={`w-full min-w-0 overflow-hidden ${
          motionEnabled ? "transition-[height] ease-in-out" : ""
        }`}
        style={{
          height: heightStyle,
          transitionDuration: motionEnabled ? `${TRANSITION_MS}ms` : undefined,
        }}
      >
        <div
          ref={innerRef}
          className={`flex w-full min-w-0 flex-col items-stretch gap-3 transition-opacity duration-150 ${
            fading && motionEnabled ? "opacity-60" : "opacity-100"
          }`}
        >
          {renderBody(renderTier)}
        </div>
      </div>
    </section>
  )
}
