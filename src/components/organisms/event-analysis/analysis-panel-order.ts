/**
 * @fileoverview Panel order persistence for Event Level Analysis grids.
 */

export const EVENT_LEVEL_ANALYSIS_PANEL_IDS = [
  "event-level-analysis-col-1",
  "event-level-analysis-col-3",
  "event-level-analysis-col-4",
  "event-level-analysis-col-5",
  "event-level-analysis-col-6",
  "event-level-analysis-col-8",
] as const

export type EventLevelAnalysisPanelId = (typeof EVENT_LEVEL_ANALYSIS_PANEL_IDS)[number]
export type AnalysisGlassPanelId = EventLevelAnalysisPanelId

const ALL_ANALYSIS_PANEL_IDS = [...EVENT_LEVEL_ANALYSIS_PANEL_IDS]

export function allAnalysisPanelIds(): readonly AnalysisGlassPanelId[] {
  return ALL_ANALYSIS_PANEL_IDS
}

const STORAGE_KEY_PREFIX = "mre-analysis-panel-order"

export type StoredPanelOrder = {
  event: EventLevelAnalysisPanelId[]
}

export function defaultPanelOrder(): StoredPanelOrder {
  return {
    event: [...EVENT_LEVEL_ANALYSIS_PANEL_IDS],
  }
}

/** Merge stored ids with defaults so new panels appear at the end after upgrades. */
export function normalizePanelOrder<T extends string>(
  stored: unknown,
  defaults: readonly T[]
): T[] {
  if (!Array.isArray(stored)) return [...defaults]
  const valid = stored.filter(
    (id): id is T => typeof id === "string" && (defaults as readonly string[]).includes(id)
  )
  const missing = defaults.filter((id) => !valid.includes(id))
  return [...valid, ...missing]
}

export function loadPanelOrder(eventId: string): StoredPanelOrder {
  if (typeof window === "undefined") return defaultPanelOrder()
  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEY_PREFIX}-${eventId}`)
    if (!raw) return defaultPanelOrder()
    const parsed = JSON.parse(raw) as Partial<StoredPanelOrder>
    return {
      event: normalizePanelOrder(parsed.event, EVENT_LEVEL_ANALYSIS_PANEL_IDS),
    }
  } catch {
    return defaultPanelOrder()
  }
}

export function savePanelOrder(eventId: string, order: StoredPanelOrder): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(`${STORAGE_KEY_PREFIX}-${eventId}`, JSON.stringify(order))
  } catch {
    // Ignore quota / private-mode errors.
  }
}

/** Expanded panels first (by expand sequence), then collapsed panels in home order. */
export function computePanelDisplayOrder(
  homeOrder: readonly string[],
  expandedStackOrder: readonly string[]
): Map<string, number> {
  const expandedSet = new Set(expandedStackOrder)
  const expandedInStack = expandedStackOrder.filter((id) => homeOrder.includes(id))
  const collapsedInHome = homeOrder.filter((id) => !expandedSet.has(id))
  const sequence = [...expandedInStack, ...collapsedInHome]
  return new Map(sequence.map((id, index) => [id, index]))
}

/** Build expand sequence from home order (Expand all). */
export function expandSequenceFromHomeOrder(homeOrder: readonly string[]): Record<string, number> {
  return Object.fromEntries(homeOrder.map((id, index) => [id, index]))
}
