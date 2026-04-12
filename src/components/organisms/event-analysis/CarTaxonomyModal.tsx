/**
 * Global (per-user) car taxonomy mapping: align LiveRC / Everlaps-style class and session strings
 * to canonical vehicle classes (seeded in `car_taxonomy_nodes`).
 *
 * UX: One table per event class — saved mapping, suggestion with Apply, or unmapped row with Save.
 * After save/delete/apply, rules refetch silently so the modal body does not flash “Loading…”.
 */

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Modal from "@/components/molecules/Modal"
import StandardButton from "@/components/atoms/StandardButton"
import ListPagination from "@/components/organisms/event-analysis/ListPagination"
import { parseApiResponse } from "@/lib/api-response-helper"
import type { EventAnalysisDataApiResponse } from "@/types/event-analysis-api"
import { taxonomyLeafNodeIds } from "@/core/car-taxonomy/leaves"
import { type RaceMatchInput, userCarTaxonomyRuleAppliesToEvent } from "@/core/car-taxonomy/resolve"
import { normalizeCarTaxonomyPattern } from "@/core/car-taxonomy/normalize"
import { suggestCarTaxonomyLeaves } from "@/core/car-taxonomy/suggestions"
import { useAppDispatch } from "@/store/hooks"
import { fetchEventAnalysisData } from "@/store/slices/dashboardSlice"
import { DEFAULT_TABLE_ROWS_PER_PAGE } from "@/lib/table-pagination"
import {
  modalFilterSelectClass,
  modalTableBodyCell,
  modalTableBodyCellAction,
  modalTableBodyCellMuted,
  modalTableCompactButtonAccentClass,
  modalTableCompactButtonClass,
  modalTableHeaderCell,
  modalTableStatusPillMappedClass,
  modalTableSortableHeaderButtonClass,
  modalTableStatusPillSuggestedClass,
  modalTableStatusPillUnmappedClass,
} from "@/components/organisms/event-analysis/car-taxonomy-modal/carTaxonomyModalStyles"

type TaxonomyNode = {
  id: string
  parentId: string | null
  slug: string
  label: string
  sortOrder: number
}

type UserRule = {
  id: string
  matchType: string
  patternNormalized: string
  taxonomyNodeId: string
  taxonomyNode: TaxonomyNode
}

function findClassNameRule(rules: UserRule[], className: string): UserRule | undefined {
  const p = normalizeCarTaxonomyPattern(className)
  return rules.find((r) => r.matchType === "CLASS_NAME" && r.patternNormalized === p)
}

function mergeRuleIntoUserRules(prev: UserRule[], rule: UserRule): UserRule[] {
  const i = prev.findIndex((r) => r.id === rule.id)
  if (i >= 0) {
    const next = [...prev]
    next[i] = rule
    return next
  }
  return [...prev, rule]
}

const MATCH_TYPE_LABELS: Record<string, string> = {
  CLASS_NAME: "Class name",
  CLASS_AND_LABEL: "Class + label",
  RACE_LABEL: "Race label",
  SECTION_HEADER: "Section header",
  SESSION_TYPE: "Session type",
}

function formatMatchTypeLabel(matchType: string): string {
  return MATCH_TYPE_LABELS[matchType] ?? matchType.replace(/_/g, " ")
}

type MappingSortColumn = "eventClass" | "vehicleClass" | "status"
type MappingSortDir = "asc" | "desc"

function SortColumnIndicator({ active, dir }: { active: boolean; dir: MappingSortDir }) {
  return (
    <span
      className={`shrink-0 tabular-nums ${active ? "text-[var(--token-accent)]" : "text-[var(--token-text-muted)] opacity-50"}`}
      aria-hidden
    >
      {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
    </span>
  )
}

export default function CarTaxonomyModal({
  isOpen,
  onClose,
  eventId,
  analysisData,
}: {
  isOpen: boolean
  onClose: () => void
  eventId: string | null
  analysisData: EventAnalysisDataApiResponse | null
}) {
  const dispatch = useAppDispatch()
  const [nodes, setNodes] = useState<TaxonomyNode[]>([])
  const [rules, setRules] = useState<UserRule[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mappingTablePage, setMappingTablePage] = useState(1)
  const [mappingPerPage, setMappingPerPage] = useState(DEFAULT_TABLE_ROWS_PER_PAGE)
  const [acceptingClassName, setAcceptingClassName] = useState<string | null>(null)
  /** Inline vehicle class pick per event class row (unmapped). */
  const [rowVehicleChoice, setRowVehicleChoice] = useState<Record<string, string>>({})
  /** Override suggested leaf per row before Apply. */
  const [suggestionLeafChoice, setSuggestionLeafChoice] = useState<Record<string, string>>({})
  const [savingRowClassName, setSavingRowClassName] = useState<string | null>(null)
  const [mappingSortColumn, setMappingSortColumn] = useState<MappingSortColumn>("eventClass")
  const [mappingSortDir, setMappingSortDir] = useState<MappingSortDir>("asc")

  /**
   * Load taxonomy nodes and user rules.
   * `silent`: refetch after mutations without toggling `loading` (keeps table visible; row spinners still apply).
   */
  const load = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true
    if (!silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const [tRes, rRes] = await Promise.all([
        fetch("/api/v1/car-taxonomy", { credentials: "include" }),
        fetch("/api/v1/user/car-taxonomy-rules", { credentials: "include", cache: "no-store" }),
      ])
      const tParsed = await parseApiResponse<{ nodes: TaxonomyNode[] }>(tRes)
      const rParsed = await parseApiResponse<{ rules: UserRule[] }>(rRes)
      if (tParsed.success && tParsed.data?.nodes) {
        setNodes(tParsed.data.nodes)
      }
      if (rParsed.success && rParsed.data?.rules) {
        setRules(rParsed.data.rules)
      }
      const taxonomyErr =
        tParsed.success && tParsed.data?.nodes
          ? null
          : !tParsed.success
            ? tParsed.error.message
            : "Could not load vehicle taxonomy"
      const rulesErr =
        rParsed.success && rParsed.data?.rules
          ? null
          : !rParsed.success
            ? rParsed.error.message
            : "Could not load your rules"
      const combined = [taxonomyErr, rulesErr].filter(Boolean).join(" ")
      setError(combined.length > 0 ? combined : null)
    } catch {
      setError("Network error loading taxonomy")
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    if (isOpen) void load()
  }, [isOpen, load])

  const leafIds = useMemo(() => taxonomyLeafNodeIds(nodes), [nodes])
  const leafNodes = useMemo(
    () => nodes.filter((n) => leafIds.has(n.id)).sort((a, b) => a.label.localeCompare(b.label)),
    [nodes, leafIds]
  )

  const leafOptions = useMemo(
    () => leafNodes.map((n) => ({ id: n.id, label: n.label })),
    [leafNodes]
  )

  const classNames = useMemo(() => {
    const s = new Set<string>()
    for (const r of analysisData?.races ?? []) {
      if (r.className?.trim()) s.add(r.className.trim())
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b))
  }, [analysisData])

  /** Event class strings that do not yet have a global CLASS_NAME rule. */
  const unmappedClassNames = useMemo(
    () => classNames.filter((cn) => findClassNameRule(rules, cn) == null),
    [classNames, rules]
  )

  const mappedEventClassCount = useMemo(
    () => classNames.filter((cn) => findClassNameRule(rules, cn) != null).length,
    [classNames, rules]
  )

  const rulesForThisEvent = useMemo(() => {
    const racesRaw = analysisData?.races ?? []
    if (racesRaw.length === 0) return []
    const races: RaceMatchInput[] = racesRaw.map((r) => ({
      className: r.className ?? "",
      raceLabel: r.raceLabel ?? "",
      sectionHeader: r.sectionHeader,
      sessionType: r.sessionType,
    }))
    return rules.filter((rule) => userCarTaxonomyRuleAppliesToEvent(rule, races))
  }, [analysisData, rules])

  /** CLASS_NAME rules that apply to this event but are not tied to a listed event class row (edge cases). */
  const normalizedEventClassPatterns = useMemo(
    () => new Set(classNames.map((cn) => normalizeCarTaxonomyPattern(cn))),
    [classNames]
  )

  const otherRulesForThisEvent = useMemo(
    () =>
      rulesForThisEvent.filter((r) => {
        if (r.matchType !== "CLASS_NAME") return true
        return !normalizedEventClassPatterns.has(r.patternNormalized)
      }),
    [rulesForThisEvent, normalizedEventClassPatterns]
  )

  const suggestionRows = useMemo(() => {
    if (!analysisData?.races?.length || leafNodes.length === 0 || classNames.length === 0) return []
    const leafs = leafNodes.map((n) => ({ id: n.id, slug: n.slug, label: n.label }))
    const races = analysisData.races
    const rows: Array<{
      key: string
      className: string
      suggestion: ReturnType<typeof suggestCarTaxonomyLeaves>[number] | null
    }> = []

    for (const cn of classNames) {
      const racesInClass = races.filter((r) => (r.className?.trim() ?? "") === cn)
      if (racesInClass.length === 0) continue
      const raceLabel = [
        ...new Set(racesInClass.map((r) => r.raceLabel?.trim()).filter(Boolean)),
      ].join(" ")
      const sectionHeader = [
        ...new Set(racesInClass.map((r) => r.sectionHeader?.trim()).filter(Boolean)),
      ].join(" ")
      const sessionType = [
        ...new Set(racesInClass.map((r) => r.sessionType?.trim()).filter(Boolean)),
      ].join(" ")
      const vehicleType = [
        ...new Set(racesInClass.map((r) => r.vehicleType?.trim()).filter(Boolean)),
      ].join(" ")

      const sug = suggestCarTaxonomyLeaves({
        leafNodes: leafs,
        className: cn,
        raceLabel,
        sectionHeader: sectionHeader || null,
        sessionType: sessionType || null,
        vehicleType: vehicleType || null,
      })
      rows.push({
        key: cn,
        className: cn,
        suggestion: sug[0] ?? null,
      })
    }
    return rows
  }, [analysisData, leafNodes, classNames])

  const suggestionByClassName = useMemo(() => {
    const m = new Map<string, (typeof suggestionRows)[number]>()
    for (const row of suggestionRows) {
      m.set(row.className, row)
    }
    return m
  }, [suggestionRows])

  const sortedClassNames = useMemo(() => {
    if (classNames.length === 0) return classNames

    const leafLabelById = new Map(leafOptions.map((o) => [o.id, o.label]))

    const getMeta = (cn: string) => {
      const classRule = findClassNameRule(rules, cn)
      if (classRule) {
        return {
          statusRank: 0,
          vehicleLabel: classRule.taxonomyNode.label,
        }
      }
      const sugEntry = suggestionByClassName.get(cn)
      const sug = sugEntry?.suggestion ?? null
      if (sug) {
        const sugLeafId = suggestionLeafChoice[cn] ?? sug.taxonomyNodeId
        const vehicleLabel = leafLabelById.get(sugLeafId) ?? sug.label
        return {
          statusRank: 1,
          vehicleLabel,
        }
      }
      const rowLeaf = rowVehicleChoice[cn] ?? ""
      const vehicleLabel = rowLeaf ? (leafLabelById.get(rowLeaf) ?? "") : ""
      return {
        statusRank: 2,
        vehicleLabel,
      }
    }

    const indexed = classNames.map((cn) => ({ cn, meta: getMeta(cn) }))
    const mult = mappingSortDir === "asc" ? 1 : -1

    indexed.sort((a, b) => {
      let cmp = 0
      if (mappingSortColumn === "eventClass") {
        cmp = a.cn.localeCompare(b.cn, undefined, { sensitivity: "base" })
      } else if (mappingSortColumn === "vehicleClass") {
        cmp = a.meta.vehicleLabel.localeCompare(b.meta.vehicleLabel, undefined, {
          sensitivity: "base",
        })
      } else {
        cmp = a.meta.statusRank - b.meta.statusRank
      }
      if (cmp === 0) {
        cmp = a.cn.localeCompare(b.cn, undefined, { sensitivity: "base" })
      }
      return cmp * mult
    })

    return indexed.map((x) => x.cn)
  }, [
    classNames,
    rules,
    suggestionByClassName,
    suggestionLeafChoice,
    rowVehicleChoice,
    leafOptions,
    mappingSortColumn,
    mappingSortDir,
  ])

  const handleMappingSortClick = useCallback((column: MappingSortColumn) => {
    setMappingSortColumn((prev) => {
      if (prev === column) {
        setMappingSortDir((d) => (d === "asc" ? "desc" : "asc"))
        return prev
      }
      setMappingSortDir("asc")
      return column
    })
  }, [])

  const unifiedTableSignature = useMemo(
    () => `${classNames.join("\0")}\0${rules.map((r) => r.id).join("\0")}`,
    [classNames, rules]
  )

  useEffect(() => {
    queueMicrotask(() => setMappingTablePage(1))
  }, [unifiedTableSignature])

  useEffect(() => {
    queueMicrotask(() => setMappingTablePage(1))
  }, [mappingSortColumn, mappingSortDir])

  const mappingTotalPages = Math.max(1, Math.ceil(sortedClassNames.length / mappingPerPage))
  const mappingStartIndex = (mappingTablePage - 1) * mappingPerPage
  const mappingPageClassNames = useMemo(
    () => sortedClassNames.slice(mappingStartIndex, mappingStartIndex + mappingPerPage),
    [sortedClassNames, mappingStartIndex, mappingPerPage]
  )

  useEffect(() => {
    if (mappingTablePage > mappingTotalPages) {
      queueMicrotask(() => setMappingTablePage(mappingTotalPages))
    }
  }, [mappingTablePage, mappingTotalPages])

  const handleMappingPerPageChange = useCallback((next: number) => {
    setMappingPerPage(next)
    setMappingTablePage(1)
  }, [])

  /** Unmapped event classes that have a keyword-based suggestion (for summary counts). */
  const pendingSuggestionCount = useMemo(
    () =>
      suggestionRows.filter((row) => {
        const mapped = findClassNameRule(rules, row.className) != null
        const hasSuggestion = row.suggestion != null
        return !mapped && hasSuggestion
      }).length,
    [suggestionRows, rules]
  )

  const showMappingPagination = classNames.length > mappingPerPage || mappingTotalPages > 1

  const performSaveClassNameRule = useCallback(
    async (className: string, nodeId: string): Promise<boolean> => {
      const body: Record<string, unknown> = {
        matchType: "CLASS_NAME",
        pattern: className,
        taxonomyNodeId: nodeId,
      }

      const res = await fetch("/api/v1/user/car-taxonomy-rules", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const parsed = await parseApiResponse<{ rule: UserRule }>(res)
      if (!parsed.success) {
        setError(parsed.error?.message ?? "Could not save rule")
        return false
      }
      if (parsed.data?.rule) {
        setRules((prev) => mergeRuleIntoUserRules(prev, parsed.data.rule))
      }
      await load({ silent: true })
      if (eventId) {
        await dispatch(fetchEventAnalysisData(eventId))
      }
      setRowVehicleChoice((prev) => {
        const next = { ...prev }
        delete next[className]
        return next
      })
      return true
    },
    [dispatch, eventId, load]
  )

  const handleSaveRowMapping = async (className: string) => {
    const nodeId = rowVehicleChoice[className]?.trim() ?? ""
    if (!nodeId) {
      setError("Select a vehicle class")
      return
    }
    setSavingRowClassName(className)
    setError(null)
    try {
      await performSaveClassNameRule(className, nodeId)
    } catch {
      setError("Could not save rule")
    } finally {
      setSavingRowClassName(null)
    }
  }

  const handleDelete = async (ruleId: string) => {
    setError(null)
    try {
      const res = await fetch(`/api/v1/user/car-taxonomy-rules/${ruleId}`, {
        method: "DELETE",
        credentials: "include",
      })
      const parsed = await parseApiResponse(res)
      if (!parsed.success) {
        setError(parsed.error?.message ?? "Could not delete")
        return
      }
      setRules((prev) => prev.filter((r) => r.id !== ruleId))
      await load({ silent: true })
      if (eventId) {
        await dispatch(fetchEventAnalysisData(eventId))
      }
    } catch {
      setError("Could not delete rule")
    }
  }

  const handleAcceptSuggestion = async (className: string, taxonomyNodeIdParam: string) => {
    setError(null)
    setAcceptingClassName(className)
    try {
      const existing = findClassNameRule(rules, className)
      if (existing?.taxonomyNodeId === taxonomyNodeIdParam) {
        return
      }
      let savedRule: UserRule | null = null
      if (existing) {
        const res = await fetch(`/api/v1/user/car-taxonomy-rules/${existing.id}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taxonomyNodeId: taxonomyNodeIdParam }),
        })
        const parsed = await parseApiResponse<{ rule: UserRule }>(res)
        if (!parsed.success) {
          setError(parsed.error?.message ?? "Could not update rule")
          return
        }
        savedRule = parsed.data?.rule ?? null
      } else {
        const res = await fetch("/api/v1/user/car-taxonomy-rules", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            matchType: "CLASS_NAME",
            pattern: className,
            taxonomyNodeId: taxonomyNodeIdParam,
          }),
        })
        const parsed = await parseApiResponse<{ rule: UserRule }>(res)
        if (!parsed.success) {
          setError(parsed.error?.message ?? "Could not save rule")
          return
        }
        savedRule = parsed.data?.rule ?? null
      }
      if (savedRule) {
        setRules((prev) => mergeRuleIntoUserRules(prev, savedRule))
      }
      await load({ silent: true })
      if (eventId) {
        await dispatch(fetchEventAnalysisData(eventId))
      }
      setSuggestionLeafChoice((prev) => {
        const next = { ...prev }
        delete next[className]
        return next
      })
    } catch {
      setError("Could not apply suggestion")
    } finally {
      setAcceptingClassName(null)
    }
  }

  const hasEventClasses = classNames.length > 0
  const racesLoaded = (analysisData?.races?.length ?? 0) > 0

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Car type mapping"
      maxWidth="2xl"
      doubleClickHeaderFullscreen
      footer={
        <div className="flex justify-end gap-2">
          <StandardButton type="button" onClick={onClose}>
            Close
          </StandardButton>
        </div>
      }
    >
      <div
        className="flex min-h-0 flex-col gap-5 text-sm text-[var(--token-text-primary)]"
        style={{ minWidth: "20rem", width: "100%", boxSizing: "border-box" }}
      >
        {loading && <p className="text-[var(--token-text-muted)]">Loading…</p>}
        {error && (
          <p
            className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] px-3 py-2 text-[var(--token-text-secondary)]"
            role="alert"
          >
            {error}
          </p>
        )}

        {/* Brief orientation — link to full guide */}
        <section aria-labelledby="car-taxonomy-intro-heading" className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <h3
              id="car-taxonomy-intro-heading"
              className="text-xs font-semibold uppercase tracking-wide text-[var(--token-text-muted)]"
            >
              Why do this
            </h3>
            <Link
              href="/guides/car-type-mapping"
              className="inline-flex shrink-0 items-center justify-center rounded p-0.5 text-[var(--token-text-muted)] transition-colors hover:text-[var(--token-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--token-surface-raised)]"
              aria-label="Open the Car type mapping guide"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={1.5} />
                <path
                  d="M12 16v-4M12 8h.01"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                />
              </svg>
            </Link>
          </div>
          <p className="text-sm leading-relaxed text-[var(--token-text-secondary)]">
            See the guide for why mapping matters and how to use this screen.
          </p>
        </section>

        {/* One row per event class: saved class-name rule, suggestion, or unmapped */}
        <section
          aria-labelledby="car-taxonomy-event-classes-heading"
          className="space-y-2 border-t border-[var(--token-border-subtle)] pt-4"
        >
          <h3
            id="car-taxonomy-event-classes-heading"
            className="text-xs font-semibold uppercase tracking-wide text-[var(--token-text-muted)]"
          >
            Event classes in this event
          </h3>

          {hasEventClasses && racesLoaded && !loading && (
            <p className="text-xs text-[var(--token-text-muted)]">
              {classNames.length} event class{classNames.length === 1 ? "" : "es"} ·{" "}
              {mappedEventClassCount} mapped · {pendingSuggestionCount} with suggestions
            </p>
          )}

          {!loading && (analysisData?.races?.length ?? 0) === 0 && (
            <div
              className="rounded-md border border-dashed border-[var(--token-border-default)] bg-[var(--token-surface)]/30 px-3 py-4 text-center text-xs text-[var(--token-text-muted)]"
              role="status"
            >
              Load event analysis to see event classes and mappings for this event.
            </div>
          )}

          {!loading &&
            (analysisData?.races?.length ?? 0) > 0 &&
            rulesForThisEvent.length === 0 &&
            rules.length > 0 && (
              <div
                className="rounded-md border border-[var(--token-border-subtle)] bg-[var(--token-surface)]/40 px-3 py-3 text-xs leading-relaxed text-[var(--token-text-secondary)]"
                role="status"
              >
                <p className="font-medium text-[var(--token-text-primary)]">
                  No saved mappings apply here yet
                </p>
                <p className="mt-1">
                  Your account has mappings, but none match this event&apos;s classes or sessions.
                  Add mappings using the table below.
                </p>
              </div>
            )}

          {!loading && rules.length === 0 && (analysisData?.races?.length ?? 0) > 0 && (
            <div
              className="rounded-md border border-[var(--token-border-subtle)] bg-[var(--token-surface)]/40 px-3 py-3 text-xs leading-relaxed text-[var(--token-text-secondary)]"
              role="status"
            >
              <p className="font-medium text-[var(--token-text-primary)]">No mappings saved yet</p>
              <p className="mt-1">
                When you apply a suggestion or save a mapping from the table, it will appear here
                for this event.
              </p>
            </div>
          )}

          {!loading && hasEventClasses && racesLoaded && (
            <div className="flex min-h-0 w-full min-w-0 flex-col gap-2">
              <div className="max-h-[min(28rem,70vh)] min-h-0 w-full min-w-0 overflow-x-auto overflow-y-auto rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)]/50">
                <table className="w-full min-w-max border-collapse text-left">
                  <thead>
                    <tr className="sticky top-0 z-[1] border-b border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]/90 backdrop-blur-sm">
                      <th
                        scope="col"
                        className={modalTableHeaderCell}
                        aria-sort={
                          mappingSortColumn === "eventClass"
                            ? mappingSortDir === "asc"
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                      >
                        <button
                          type="button"
                          className={modalTableSortableHeaderButtonClass}
                          onClick={() => handleMappingSortClick("eventClass")}
                        >
                          <span>Event Sessions</span>
                          <SortColumnIndicator
                            active={mappingSortColumn === "eventClass"}
                            dir={mappingSortDir}
                          />
                        </button>
                      </th>
                      <th
                        scope="col"
                        className={modalTableHeaderCell}
                        aria-sort={
                          mappingSortColumn === "vehicleClass"
                            ? mappingSortDir === "asc"
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                      >
                        <button
                          type="button"
                          className={modalTableSortableHeaderButtonClass}
                          onClick={() => handleMappingSortClick("vehicleClass")}
                        >
                          <span>Vehicle Class</span>
                          <SortColumnIndicator
                            active={mappingSortColumn === "vehicleClass"}
                            dir={mappingSortDir}
                          />
                        </button>
                      </th>
                      <th
                        scope="col"
                        className={modalTableHeaderCell}
                        aria-sort={
                          mappingSortColumn === "status"
                            ? mappingSortDir === "asc"
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                      >
                        <button
                          type="button"
                          className={modalTableSortableHeaderButtonClass}
                          onClick={() => handleMappingSortClick("status")}
                        >
                          <span>Status</span>
                          <SortColumnIndicator
                            active={mappingSortColumn === "status"}
                            dir={mappingSortDir}
                          />
                        </button>
                      </th>
                      <th scope="col" className={`${modalTableHeaderCell} text-right`}>
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappingPageClassNames.map((cn) => {
                      const classRule = findClassNameRule(rules, cn)
                      const sugEntry = suggestionByClassName.get(cn)
                      const sug = sugEntry?.suggestion ?? null
                      const busy = acceptingClassName === cn

                      if (classRule) {
                        return (
                          <tr
                            key={cn}
                            className="border-b border-[var(--token-border-muted)]/80 odd:bg-[var(--token-surface)]/30"
                          >
                            <td className={`${modalTableBodyCellMuted} max-w-[20rem] break-words`}>
                              {cn}
                            </td>
                            <td className={`${modalTableBodyCell} max-w-[16rem] font-medium`}>
                              {classRule.taxonomyNode.label}
                            </td>
                            <td className={`${modalTableBodyCell} whitespace-nowrap`}>
                              <span className={modalTableStatusPillMappedClass}>Mapped</span>
                            </td>
                            <td className={modalTableBodyCellAction}>
                              <StandardButton
                                type="button"
                                className={modalTableCompactButtonClass}
                                onClick={() => void handleDelete(classRule.id)}
                              >
                                Remove
                              </StandardButton>
                            </td>
                          </tr>
                        )
                      }

                      if (sug) {
                        const sugLeafId = suggestionLeafChoice[cn] ?? sug.taxonomyNodeId
                        return (
                          <tr
                            key={cn}
                            className="border-b border-[var(--token-border-muted)]/80 bg-[var(--token-accent-soft-bg)]/25"
                          >
                            <td className={`${modalTableBodyCellMuted} max-w-[20rem] break-words`}>
                              {cn}
                            </td>
                            <td
                              className={`${modalTableBodyCell} max-w-[min(16rem,100%)] align-top`}
                            >
                              <select
                                className={`${modalFilterSelectClass} max-w-full`}
                                value={sugLeafId}
                                onChange={(e) =>
                                  setSuggestionLeafChoice((prev) => ({
                                    ...prev,
                                    [cn]: e.target.value,
                                  }))
                                }
                                disabled={
                                  loading ||
                                  busy ||
                                  (savingRowClassName !== null && savingRowClassName !== cn) ||
                                  (acceptingClassName !== null && acceptingClassName !== cn)
                                }
                                aria-label={`Vehicle class for ${cn}`}
                              >
                                {leafOptions.map((o) => (
                                  <option key={o.id} value={o.id}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className={`${modalTableBodyCell} whitespace-nowrap`}>
                              <span className={modalTableStatusPillSuggestedClass}>Suggested</span>
                            </td>
                            <td className={modalTableBodyCellAction}>
                              <StandardButton
                                type="button"
                                className={modalTableCompactButtonAccentClass}
                                disabled={
                                  loading ||
                                  busy ||
                                  (savingRowClassName !== null && savingRowClassName !== cn) ||
                                  (acceptingClassName !== null && acceptingClassName !== cn)
                                }
                                onClick={() => void handleAcceptSuggestion(cn, sugLeafId)}
                              >
                                {busy ? "Applying…" : "Apply"}
                              </StandardButton>
                            </td>
                          </tr>
                        )
                      }

                      const rowBusy = savingRowClassName === cn
                      const rowLeaf = rowVehicleChoice[cn] ?? ""
                      return (
                        <tr
                          key={cn}
                          className="border-b border-[var(--token-border-muted)]/80 odd:bg-[var(--token-surface)]/30"
                        >
                          <td className={`${modalTableBodyCellMuted} max-w-[20rem] break-words`}>
                            {cn}
                          </td>
                          <td className={`${modalTableBodyCell} max-w-[min(16rem,100%)] align-top`}>
                            <select
                              className={`${modalFilterSelectClass} max-w-full`}
                              value={rowLeaf}
                              onChange={(e) =>
                                setRowVehicleChoice((prev) => ({
                                  ...prev,
                                  [cn]: e.target.value,
                                }))
                              }
                              disabled={
                                loading ||
                                rowBusy ||
                                (savingRowClassName !== null && savingRowClassName !== cn) ||
                                (acceptingClassName !== null && acceptingClassName !== cn)
                              }
                              aria-label={`Vehicle class for ${cn}`}
                            >
                              <option value="">Choose vehicle class…</option>
                              {leafOptions.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className={`${modalTableBodyCell} whitespace-nowrap`}>
                            <span className={modalTableStatusPillUnmappedClass}>Unmapped</span>
                          </td>
                          <td className={modalTableBodyCellAction}>
                            <StandardButton
                              type="button"
                              className={modalTableCompactButtonAccentClass}
                              disabled={
                                loading ||
                                rowBusy ||
                                (savingRowClassName !== null && savingRowClassName !== cn) ||
                                (acceptingClassName !== null && acceptingClassName !== cn) ||
                                !rowLeaf.trim()
                              }
                              onClick={() => void handleSaveRowMapping(cn)}
                            >
                              {rowBusy ? "Saving…" : "Save mapping"}
                            </StandardButton>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {showMappingPagination && (
                <div className="min-w-0 w-full max-w-full p-1">
                  <ListPagination
                    currentPage={mappingTablePage}
                    totalPages={mappingTotalPages}
                    onPageChange={setMappingTablePage}
                    itemsPerPage={mappingPerPage}
                    totalItems={classNames.length}
                    itemLabel="event classes"
                    onRowsPerPageChange={handleMappingPerPageChange}
                    embedded
                  />
                </div>
              )}
            </div>
          )}

          {otherRulesForThisEvent.length > 0 && !loading && racesLoaded && (
            <div className="space-y-2 border-t border-[var(--token-border-subtle)] pt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--token-text-muted)]">
                Other rules matching this event
              </h4>
              <p className="text-xs text-[var(--token-text-secondary)]">
                These rules are not class-name mappings for the rows above (for example race label
                or session matches). Remove only if you intend to change how this event is
                classified.
              </p>
              <div className="max-h-48 min-h-0 w-full min-w-0 overflow-x-auto overflow-y-auto rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)]/50">
                <table className="w-full min-w-max border-collapse text-left">
                  <thead>
                    <tr className="sticky top-0 z-[1] border-b border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]/90 backdrop-blur-sm">
                      <th scope="col" className={modalTableHeaderCell}>
                        Match type
                      </th>
                      <th scope="col" className={modalTableHeaderCell}>
                        Pattern
                      </th>
                      <th scope="col" className={modalTableHeaderCell}>
                        Vehicle class
                      </th>
                      <th scope="col" className={`${modalTableHeaderCell} text-right`}>
                        Remove
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {otherRulesForThisEvent.map((rule) => (
                      <tr
                        key={rule.id}
                        className="border-b border-[var(--token-border-muted)]/80 odd:bg-[var(--token-surface)]/30"
                      >
                        <td className={`${modalTableBodyCell} whitespace-nowrap`}>
                          {formatMatchTypeLabel(rule.matchType)}
                        </td>
                        <td className={`${modalTableBodyCellMuted} max-w-[24rem] break-words`}>
                          {rule.patternNormalized}
                        </td>
                        <td className={`${modalTableBodyCell} max-w-[16rem] font-medium`}>
                          {rule.taxonomyNode.label}
                        </td>
                        <td className={modalTableBodyCellAction}>
                          <StandardButton
                            type="button"
                            className={modalTableCompactButtonClass}
                            onClick={() => void handleDelete(rule.id)}
                          >
                            Remove
                          </StandardButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!loading &&
            pendingSuggestionCount === 0 &&
            suggestionRows.length > 0 &&
            unmappedClassNames.length > 0 && (
              <div
                className="rounded-md border border-[var(--token-border-subtle)] bg-[var(--token-surface)]/50 px-3 py-3 text-xs leading-relaxed text-[var(--token-text-secondary)]"
                role="status"
              >
                <p className="font-medium text-[var(--token-text-primary)]">
                  Some classes still need a vehicle class
                </p>
                <p className="mt-1">
                  Unmapped rows had no keyword suggestion. Pick a vehicle class in the row and click{" "}
                  <span className="font-medium text-[var(--token-text-primary)]">Save mapping</span>
                  .
                </p>
              </div>
            )}

          {!loading &&
            suggestionRows.length === 0 &&
            hasEventClasses &&
            racesLoaded &&
            leafNodes.length === 0 && (
              <div
                className="rounded-md border border-[var(--token-border-subtle)] bg-[var(--token-surface)]/50 px-3 py-3 text-xs leading-relaxed text-[var(--token-text-secondary)]"
                role="status"
              >
                <p className="font-medium text-[var(--token-text-primary)]">
                  Vehicle taxonomy not ready
                </p>
                <p className="mt-1">
                  Finish loading to see keyword suggestions. You can still map classes from the
                  table using the vehicle class dropdown and Save mapping on each row.
                </p>
              </div>
            )}

          {!loading && !hasEventClasses && racesLoaded && (
            <p className="text-xs text-[var(--token-text-muted)]" role="status">
              No event classes found in this analysis yet.
            </p>
          )}
        </section>
      </div>
    </Modal>
  )
}
