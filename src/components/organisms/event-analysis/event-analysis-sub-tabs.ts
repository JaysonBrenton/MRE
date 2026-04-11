/**
 * @fileoverview Shared ids and labels for Event Analysis / Session Analysis sub-views
 *
 * @description Used by the dashboard toolbar dropdown and OverviewTab content.
 */

/** Sub-views shared by Event and Session Analysis (charts, tables). */
export const CORE_ANALYSIS_SUB_TAB_IDS = [
  "event-results",
  "fastest-laps",
  "fastest-average-laps",
  "driver-analysis",
] as const

/** Event Analysis only: includes mains-ladder views (not applicable per-session). */
export const EVENT_ANALYSIS_SUB_TAB_IDS = [
  ...CORE_ANALYSIS_SUB_TAB_IDS,
  "bump-ups",
  "driver-progression",
] as const

export type EventAnalysisSubTabId = (typeof EVENT_ANALYSIS_SUB_TAB_IDS)[number]

/** Whether the user is in the Event Analysis or Session Analysis primary tab (affects first sub-tab label). */
export type AnalysisSubTabScope = "event" | "session"

const STATIC_SUB_TAB_LABELS: Record<
  Exclude<EventAnalysisSubTabId, "event-results" | "bump-ups" | "driver-progression">,
  string
> = {
  "fastest-laps": "Fastest Laps",
  "fastest-average-laps": "Fastest Average Laps",
  "driver-analysis": "Driver Analysis",
}

/** Label for a sub-tab, including Event vs Session Results for `event-results`. */
export function getSubTabLabel(id: EventAnalysisSubTabId, scope: AnalysisSubTabScope): string {
  if (id === "event-results") {
    return scope === "session" ? "Session Results" : "Event Results"
  }
  if (id === "bump-ups") return "Bump-Up"
  if (id === "driver-progression") return "Driver Progression"
  return STATIC_SUB_TAB_LABELS[id]
}

/** Ordered list for menus (labels depend on scope). Session Analysis omits event-wide ladder items. */
export function getSubTabOptions(scope: AnalysisSubTabScope): {
  id: EventAnalysisSubTabId
  label: string
}[] {
  const ids = scope === "event" ? EVENT_ANALYSIS_SUB_TAB_IDS : CORE_ANALYSIS_SUB_TAB_IDS
  return ids.map((id) => ({
    id,
    label: getSubTabLabel(id, scope),
  }))
}
