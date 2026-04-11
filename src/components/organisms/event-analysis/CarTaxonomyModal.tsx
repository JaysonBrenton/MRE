/**
 * Global (per-user) car taxonomy mapping: align LiveRC / Everlaps-style class and session strings
 * to canonical vehicle classes (seeded in `car_taxonomy_nodes`).
 */

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Modal from "@/components/molecules/Modal"
import StandardButton from "@/components/atoms/StandardButton"
import ListPagination from "@/components/organisms/event-analysis/ListPagination"
import { parseApiResponse } from "@/lib/api-response-helper"
import type { EventAnalysisDataApiResponse } from "@/types/event-analysis-api"
import { taxonomyLeafNodeIds } from "@/core/car-taxonomy/leaves"
import { userCarTaxonomyRuleAppliesToEvent } from "@/core/car-taxonomy/resolve"
import { normalizeCarTaxonomyPattern } from "@/core/car-taxonomy/normalize"
import { suggestCarTaxonomyLeaves } from "@/core/car-taxonomy/suggestions"
import { useAppDispatch } from "@/store/hooks"
import { fetchEventAnalysisData } from "@/store/slices/dashboardSlice"
import { DEFAULT_TABLE_ROWS_PER_PAGE } from "@/lib/table-pagination"

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

/** Matches SessionRaceResultsTable toolbar selects (session / driver filters). */
const modalFilterSelectClass =
  "min-w-[10rem] max-w-[min(100%,22rem)] rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] px-2 py-1 text-xs text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"

const modalTableHeaderCell =
  "px-3 py-2 text-left text-xs font-semibold text-[var(--token-text-primary)]"
const modalTableBodyCell = "px-3 py-2 text-xs text-[var(--token-text-primary)]"
const modalTableBodyCellMuted = "px-3 py-2 text-xs text-[var(--token-text-secondary)]"
const modalTableBodyCellAction = "px-3 py-2 text-right"

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
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedClassName, setSelectedClassName] = useState("")
  const [taxonomyNodeId, setTaxonomyNodeId] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [rulesTablePage, setRulesTablePage] = useState(1)
  const [rulesPerPage, setRulesPerPage] = useState(DEFAULT_TABLE_ROWS_PER_PAGE)
  const [suggestionsTablePage, setSuggestionsTablePage] = useState(1)
  const [suggestionsPerPage, setSuggestionsPerPage] = useState(DEFAULT_TABLE_ROWS_PER_PAGE)
  const [acceptingClassName, setAcceptingClassName] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
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
          : (tParsed.error?.message ?? "Could not load vehicle taxonomy")
      const rulesErr =
        rParsed.success && rParsed.data?.rules
          ? null
          : (rParsed.error?.message ?? "Could not load your rules")
      const combined = [taxonomyErr, rulesErr].filter(Boolean).join(" ")
      setError(combined.length > 0 ? combined : null)
    } catch {
      setError("Network error loading taxonomy")
    } finally {
      setLoading(false)
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

  const addRuleAvailable = unmappedClassNames.length > 0
  const allClassNamesMapped = classNames.length > 0 && unmappedClassNames.length === 0

  useEffect(() => {
    if (selectedClassName && !unmappedClassNames.includes(selectedClassName)) {
      setSelectedClassName("")
    }
  }, [selectedClassName, unmappedClassNames])

  const rulesForThisEvent = useMemo(() => {
    const races = analysisData?.races ?? []
    if (races.length === 0) return []
    return rules.filter((rule) => userCarTaxonomyRuleAppliesToEvent(rule, races))
  }, [analysisData, rules])

  const rulesTableSignature = useMemo(
    () => rulesForThisEvent.map((r) => r.id).join("\0"),
    [rulesForThisEvent]
  )

  useEffect(() => {
    queueMicrotask(() => setRulesTablePage(1))
  }, [rulesTableSignature])

  const rulesTotalPages = Math.max(1, Math.ceil(rulesForThisEvent.length / rulesPerPage))
  const rulesStartIndex = (rulesTablePage - 1) * rulesPerPage
  const rulesPageRows = useMemo(
    () => rulesForThisEvent.slice(rulesStartIndex, rulesStartIndex + rulesPerPage),
    [rulesForThisEvent, rulesStartIndex, rulesPerPage]
  )

  useEffect(() => {
    if (rulesTablePage > rulesTotalPages) {
      queueMicrotask(() => setRulesTablePage(rulesTotalPages))
    }
  }, [rulesTablePage, rulesTotalPages])

  const handleRulesPerPageChange = useCallback((next: number) => {
    setRulesPerPage(next)
    setRulesTablePage(1)
  }, [])

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

  /** Unmapped classes only, with a keyword suggestion (hides “Mapped” and no-suggestion rows). */
  const visibleSuggestionRows = useMemo(
    () =>
      suggestionRows.filter((row) => {
        const mapped = findClassNameRule(rules, row.className) != null
        const hasSuggestion = row.suggestion != null
        return !mapped && hasSuggestion
      }),
    [suggestionRows, rules]
  )

  const suggestionsTableSignature = useMemo(
    () => visibleSuggestionRows.map((r) => r.key).join("\0"),
    [visibleSuggestionRows]
  )

  useEffect(() => {
    queueMicrotask(() => setSuggestionsTablePage(1))
  }, [suggestionsTableSignature])

  const suggestionsTotalPages = Math.max(
    1,
    Math.ceil(visibleSuggestionRows.length / suggestionsPerPage)
  )
  const suggestionsStartIndex = (suggestionsTablePage - 1) * suggestionsPerPage
  const suggestionsPageRows = useMemo(
    () =>
      visibleSuggestionRows.slice(
        suggestionsStartIndex,
        suggestionsStartIndex + suggestionsPerPage
      ),
    [visibleSuggestionRows, suggestionsStartIndex, suggestionsPerPage]
  )

  useEffect(() => {
    if (suggestionsTablePage > suggestionsTotalPages) {
      queueMicrotask(() => setSuggestionsTablePage(suggestionsTotalPages))
    }
  }, [suggestionsTablePage, suggestionsTotalPages])

  const handleSuggestionsPerPageChange = useCallback((next: number) => {
    setSuggestionsPerPage(next)
    setSuggestionsTablePage(1)
  }, [])

  const handleSave = async () => {
    if (!taxonomyNodeId) {
      setError("Select a vehicle class")
      return
    }
    if (!selectedClassName.trim()) {
      setError("Choose a class name from this event")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        matchType: "CLASS_NAME",
        pattern: selectedClassName,
        taxonomyNodeId,
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
        setSaving(false)
        return
      }
      if (parsed.data?.rule) {
        setRules((prev) => mergeRuleIntoUserRules(prev, parsed.data.rule))
      }
      await load()
      if (eventId) {
        await dispatch(fetchEventAnalysisData(eventId))
      }
      setSelectedClassName("")
      setTaxonomyNodeId("")
    } catch {
      setError("Could not save rule")
    } finally {
      setSaving(false)
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
      await load()
      if (eventId) {
        await dispatch(fetchEventAnalysisData(eventId))
      }
    } catch {
      setError("Could not delete rule")
    }
  }

  const handleAcceptSuggestion = async (className: string, taxonomyNodeId: string) => {
    setError(null)
    setAcceptingClassName(className)
    try {
      const existing = findClassNameRule(rules, className)
      if (existing?.taxonomyNodeId === taxonomyNodeId) {
        return
      }
      let savedRule: UserRule | null = null
      if (existing) {
        const res = await fetch(`/api/v1/user/car-taxonomy-rules/${existing.id}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taxonomyNodeId }),
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
            taxonomyNodeId,
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
      await load()
      if (eventId) {
        await dispatch(fetchEventAnalysisData(eventId))
      }
    } catch {
      setError("Could not apply suggestion")
    } finally {
      setAcceptingClassName(null)
    }
  }

  const leafOptions = leafNodes.map((n) => ({
    id: n.id,
    label: n.label,
  }))

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Car type mapping"
      subtitle="Saved rules apply account-wide when their pattern matches a race. The list below is limited to rules that match this event. LiveRC data and other users are unchanged."
      maxWidth="2xl"
      footer={
        <div className="flex justify-end gap-2">
          <StandardButton type="button" onClick={onClose}>
            Close
          </StandardButton>
        </div>
      }
    >
      <div
        className="flex min-h-0 flex-col gap-4 text-sm text-[var(--token-text-primary)]"
        style={{ minWidth: "20rem", width: "100%", boxSizing: "border-box" }}
      >
        {loading && <p className="text-[var(--token-text-muted)]">Loading…</p>}
        {error && (
          <p className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] px-3 py-2 text-[var(--token-text-secondary)]">
            {error}
          </p>
        )}

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--token-text-muted)]">
            Add rule from this event
          </h3>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex min-w-0 max-w-full items-center gap-2">
              <span
                className="shrink-0 text-xs font-medium text-[var(--token-text-secondary)]"
                title="Distinct LiveRC class names from this event"
              >
                Class name
              </span>
              {allClassNamesMapped ? (
                <span className="min-w-[10rem] max-w-[min(100%,22rem)] text-xs text-[var(--token-text-muted)]">
                  All mappings completed for this event.
                </span>
              ) : classNames.length === 0 ? (
                <span className="min-w-[10rem] max-w-[min(100%,22rem)] text-xs text-[var(--token-text-muted)]">
                  No class names in this event.
                </span>
              ) : (
                <select
                  id="car-taxonomy-modal-class-name"
                  className={modalFilterSelectClass}
                  value={selectedClassName}
                  onChange={(e) => setSelectedClassName(e.target.value)}
                  disabled={loading}
                >
                  <option value="">Select…</option>
                  {unmappedClassNames.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <label
                htmlFor="car-taxonomy-modal-vehicle-class"
                className="shrink-0 text-xs font-medium text-[var(--token-text-secondary)]"
              >
                Vehicle class
              </label>
              <select
                id="car-taxonomy-modal-vehicle-class"
                className={modalFilterSelectClass}
                value={taxonomyNodeId}
                onChange={(e) => setTaxonomyNodeId(e.target.value)}
                disabled={loading || !addRuleAvailable}
              >
                <option value="">Select…</option>
                {leafOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <StandardButton
              type="button"
              className="border-[var(--token-accent)] bg-[var(--token-accent-soft-bg)] text-[var(--token-accent)] hover:bg-[var(--token-accent-soft-bg)]/80"
              disabled={
                saving ||
                loading ||
                !addRuleAvailable ||
                !selectedClassName.trim() ||
                !taxonomyNodeId
              }
              onClick={() => void handleSave()}
            >
              {saving ? "Saving…" : "Save rule"}
            </StandardButton>
          </div>
        </section>

        <section className="space-y-2 border-t border-[var(--token-border-subtle)] pt-3">
          <button
            type="button"
            className="text-xs font-semibold uppercase tracking-wide text-[var(--token-accent)] hover:underline"
            onClick={() => setShowSuggestions((s) => !s)}
          >
            {showSuggestions ? "Hide" : "Show"} suggestions (this event)
          </button>
          {showSuggestions && visibleSuggestionRows.length > 0 && (
            <div className="flex min-h-0 w-full min-w-0 flex-col gap-2">
              <div className="max-h-64 min-h-0 w-full min-w-0 overflow-x-auto overflow-y-auto rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)]/50">
                <table className="w-full min-w-max border-collapse text-left">
                  <thead>
                    <tr className="sticky top-0 z-[1] border-b border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]/90 backdrop-blur-sm">
                      <th scope="col" className={modalTableHeaderCell}>
                        Class type
                      </th>
                      <th scope="col" className={modalTableHeaderCell}>
                        Suggestion
                      </th>
                      <th scope="col" className={`${modalTableHeaderCell} text-right`}>
                        Accept
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {suggestionsPageRows.map((row) => {
                      const sug = row.suggestion!
                      const busy = acceptingClassName === row.className
                      return (
                        <tr
                          key={row.key}
                          className="border-b border-[var(--token-border-muted)]/80 odd:bg-[var(--token-surface)]/30"
                        >
                          <td
                            className={`${modalTableBodyCell} max-w-[24rem] break-words font-medium`}
                          >
                            {row.className || "—"}
                          </td>
                          <td className={modalTableBodyCellMuted}>
                            <div className="space-y-0.5">
                              <div className="font-medium text-[var(--token-text-primary)]">
                                {sug.label}
                              </div>
                              <div className="max-w-[28rem] break-words text-[var(--token-text-muted)]">
                                {sug.reason}
                              </div>
                            </div>
                          </td>
                          <td className={modalTableBodyCellAction}>
                            <button
                              type="button"
                              className="text-[var(--token-accent)] hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={loading || busy || saving}
                              onClick={() =>
                                void handleAcceptSuggestion(row.className, sug.taxonomyNodeId)
                              }
                            >
                              {busy ? "Saving…" : "Accept"}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="min-w-0 w-full max-w-full">
                <ListPagination
                  currentPage={suggestionsTablePage}
                  totalPages={suggestionsTotalPages}
                  onPageChange={setSuggestionsTablePage}
                  itemsPerPage={suggestionsPerPage}
                  totalItems={visibleSuggestionRows.length}
                  itemLabel="classes"
                  onRowsPerPageChange={handleSuggestionsPerPageChange}
                  embedded
                />
              </div>
            </div>
          )}
          {showSuggestions && visibleSuggestionRows.length === 0 && suggestionRows.length > 0 && (
            <p className="text-xs text-[var(--token-text-muted)]">
              No unmapped classes with keyword suggestions. Add rules manually above for classes
              that still need a mapping.
            </p>
          )}
          {showSuggestions && suggestionRows.length === 0 && (
            <p className="text-xs text-[var(--token-text-muted)]">
              No keyword-based suggestions for this event.
            </p>
          )}
        </section>

        <section className="space-y-2 border-t border-[var(--token-border-subtle)] pt-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--token-text-muted)]">
            Rules for this event
          </h3>
          {!loading && (analysisData?.races?.length ?? 0) === 0 && (
            <p className="text-xs text-[var(--token-text-muted)]">
              Load event analysis to see which saved rules apply here.
            </p>
          )}
          {!loading &&
            (analysisData?.races?.length ?? 0) > 0 &&
            rulesForThisEvent.length === 0 &&
            rules.length > 0 && (
              <p className="text-xs text-[var(--token-text-muted)]">
                No saved rules match this event&apos;s classes or sessions.
              </p>
            )}
          {!loading && rules.length === 0 && (analysisData?.races?.length ?? 0) > 0 && (
            <p className="text-xs text-[var(--token-text-muted)]">No rules yet.</p>
          )}
          {rulesForThisEvent.length > 0 && (
            <div className="flex min-h-0 w-full min-w-0 flex-col gap-2">
              <div className="max-h-64 min-h-0 w-full min-w-0 overflow-x-auto overflow-y-auto rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)]/50">
                <table className="w-full min-w-max border-collapse text-left">
                  <thead>
                    <tr className="sticky top-0 z-[1] border-b border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]/90 backdrop-blur-sm">
                      <th scope="col" className={modalTableHeaderCell}>
                        Vehicle class
                      </th>
                      <th scope="col" className={modalTableHeaderCell}>
                        Class type
                      </th>
                      <th scope="col" className={`${modalTableHeaderCell} text-right`}>
                        Remove
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rulesPageRows.map((rule) => (
                      <tr
                        key={rule.id}
                        className="border-b border-[var(--token-border-muted)]/80 odd:bg-[var(--token-surface)]/30"
                      >
                        <td className={`${modalTableBodyCell} max-w-[24rem] font-medium`}>
                          {rule.taxonomyNode.label}
                        </td>
                        <td className={`${modalTableBodyCellMuted} max-w-[28rem] break-words`}>
                          {rule.patternNormalized}
                        </td>
                        <td className={modalTableBodyCellAction}>
                          <button
                            type="button"
                            className="text-[var(--token-accent)] hover:underline"
                            onClick={() => void handleDelete(rule.id)}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="min-w-0 w-full max-w-full">
                <ListPagination
                  currentPage={rulesTablePage}
                  totalPages={rulesTotalPages}
                  onPageChange={setRulesTablePage}
                  itemsPerPage={rulesPerPage}
                  totalItems={rulesForThisEvent.length}
                  itemLabel="rules"
                  onRowsPerPageChange={handleRulesPerPageChange}
                  embedded
                />
              </div>
            </div>
          )}
        </section>
      </div>
    </Modal>
  )
}
