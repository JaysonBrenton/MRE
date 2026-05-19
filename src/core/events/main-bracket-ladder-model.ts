import type { EventAnalysisData } from "./get-event-analysis-data"
import { getSessionsForBumpUpInference } from "./get-sessions-data"
import { parseBracketFinalDenominator } from "./bump-up-ladder-strategies"
import {
  getLadderRank,
  isSessionMainForBumpUps,
  labelLooksLikeLcq,
  sortSessionsForLadder,
} from "./infer-bump-ups"
import { describeMainLadderRound } from "./driver-main-event-progression"

export type BracketNodeBranch = "odd" | "even" | "center" | "stacked"

export interface BracketNodeDriver {
  driverId: string
  driverName: string
  position: number | null
  qualifyingPosition: number | null
  lapsCompleted: number
  totalTimeSeconds: number | null
  advancedFromPriorRound: boolean
  progressedFromRoundLabel: string | null
}

export interface MainBracketLadderNode {
  sessionId: string
  raceLabel: string
  className: string
  roundLabel: string
  roundKind: string
  raceOrder: number | null
  branch: BracketNodeBranch
  /**
   * Horizontal column index: early bracket depth (large 1/n finals) left, closer to A-main right.
   * Odd and Even at the same denominator share the same column.
   */
  tierIndex: number
  rowIndex: number
  hasResults: boolean
  drivers: BracketNodeDriver[]
  advancedDriverCount: number
  startTime: Date | null
}

export interface MainBracketLadderEdge {
  fromSessionId: string
  toSessionId: string
  kind: "direct" | "via_lcq"
  driverCount: number | null
}

export interface MainBracketLadderModel {
  className: string
  nodes: MainBracketLadderNode[]
  edges: MainBracketLadderEdge[]
}

/**
 * When multiple ladder nodes share the same column (e.g. lettered mains), pick the edge target
 * that matches the source branch (odd/even) when possible.
 */
function pickNextTargetFromCandidates(
  from: MainBracketLadderNode,
  candidates: MainBracketLadderNode[]
): MainBracketLadderNode | null {
  if (candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0]!
  if (from.branch === "odd" || from.branch === "even") {
    const match = candidates.find((t) => t.branch === from.branch)
    if (match) return match
  }
  const center = candidates.find((t) => t.branch === "center")
  if (center) return center
  return candidates[0]!
}

/**
 * Next visual/ladder hop from `from`, derived from progression edges and session labels only
 * (no bump-up inference). Prefers the nearest non-LCQ target; falls back to LCQ when that is the
 * only outgoing edge.
 */
export function resolveNextRoundTargetNode(
  from: MainBracketLadderNode,
  model: MainBracketLadderModel
): MainBracketLadderNode | null {
  const nodeById = new Map(model.nodes.map((n) => [n.sessionId, n]))
  const outgoing = model.edges.filter((e) => e.fromSessionId === from.sessionId)
  if (outgoing.length === 0) return null

  const outgoingTargets = outgoing
    .map((e) => nodeById.get(e.toSessionId))
    .filter((n): n is MainBracketLadderNode => Boolean(n))

  const nonLcq = outgoingTargets.filter((n) => !labelLooksLikeLcq(n.raceLabel))
  const pool = nonLcq.length > 0 ? nonLcq : outgoingTargets
  const minTier = Math.min(...pool.map((t) => t.tierIndex))
  const atMinTier = pool.filter((t) => t.tierIndex === minTier)
  return pickNextTargetFromCandidates(from, atMinTier)
}

/** Drivers in `from` who also appear in {@link resolveNextRoundTargetNode} (observed advancement). */
export function driversAdvancedToNextRoundSorted(
  from: MainBracketLadderNode,
  model: MainBracketLadderModel
): { target: MainBracketLadderNode | null; drivers: BracketNodeDriver[] } {
  const target = resolveNextRoundTargetNode(from, model)
  if (!target) {
    return { target: null, drivers: [] }
  }
  const toIds = new Set(target.drivers.map((d) => d.driverId))
  const drivers = from.drivers
    .filter((d) => toIds.has(d.driverId))
    .slice()
    .sort((a, b) => {
      if (a.position !== null && b.position !== null && a.position !== b.position) {
        return a.position - b.position
      }
      if (a.position !== null && b.position === null) return -1
      if (a.position === null && b.position !== null) return 1
      return a.driverName.localeCompare(b.driverName, undefined, { sensitivity: "base" })
    })
  return { target, drivers }
}

function formatRoundLabel(raceLabel: string, fallback: string): string {
  const denom = parseBracketFinalDenominator(raceLabel)
  const hasOdd = /\bodd\b/i.test(raceLabel)
  const hasEven = /\beven\b/i.test(raceLabel)
  if (denom !== null) {
    if (hasOdd) return `1/${denom} Odd`
    if (hasEven) return `1/${denom} Even`
    return `1/${denom} Final`
  }
  return fallback
}

function branchForRace(raceLabel: string): BracketNodeBranch {
  const denom = parseBracketFinalDenominator(raceLabel)
  if (denom === 1) {
    return "center"
  }
  const L = raceLabel.toLowerCase()
  if (/\bodd\b/.test(L)) return "odd"
  if (/\beven\b/.test(L)) return "even"
  return "center"
}

function tierKeyFromRank(rank: number): number {
  return Math.floor(rank * 1000)
}

function log2IntPow2(d: number): number {
  return Math.round(Math.log2(d))
}

function edgeTargetForBranch(
  nextColumnNodes: MainBracketLadderNode[],
  branch: BracketNodeBranch
): MainBracketLadderNode | null {
  if (nextColumnNodes.length === 0) return null
  const exact = nextColumnNodes.find((n) => n.branch === branch)
  if (exact) return exact
  const center = nextColumnNodes.find((n) => n.branch === "center")
  if (center) return center
  return nextColumnNodes[0] ?? null
}

type RankedSession = {
  session: ReturnType<typeof sortSessionsForLadder>[number]
  rank: number
}

function buildTransitionEdgesFromDriverPaths(
  rankedSessions: RankedSession[],
  nodes: MainBracketLadderNode[]
): MainBracketLadderEdge[] {
  const sessionOrderIndex = new Map<string, number>()
  rankedSessions.forEach(({ session }, idx) => {
    sessionOrderIndex.set(session.id, idx)
  })

  const sessionsById = new Map(rankedSessions.map(({ session }) => [session.id, session]))
  const nodeBySessionId = new Map(nodes.map((n) => [n.sessionId, n]))

  const appearancesByDriver = new Map<string, Set<string>>()
  for (const { session } of rankedSessions) {
    const seenInSession = new Set<string>()
    for (const r of session.results) {
      if (seenInSession.has(r.driverId)) continue
      seenInSession.add(r.driverId)
      const set = appearancesByDriver.get(r.driverId) ?? new Set<string>()
      set.add(session.id)
      appearancesByDriver.set(r.driverId, set)
    }
  }

  const edgesByKey = new Map<
    string,
    {
      fromSessionId: string
      toSessionId: string
      kind: MainBracketLadderEdge["kind"]
      driverCount: number
    }
  >()
  for (const [, sessionIds] of appearancesByDriver) {
    const orderedIds = Array.from(sessionIds).sort((a, b) => {
      const ia = sessionOrderIndex.get(a) ?? 0
      const ib = sessionOrderIndex.get(b) ?? 0
      return ia - ib
    })
    for (let i = 0; i < orderedIds.length - 1; i++) {
      const fromSessionId = orderedIds[i]!
      const toSessionId = orderedIds[i + 1]!
      if (fromSessionId === toSessionId) continue
      const fromSession = sessionsById.get(fromSessionId)
      const toSession = sessionsById.get(toSessionId)
      const fromNode = nodeBySessionId.get(fromSessionId)
      const toNode = nodeBySessionId.get(toSessionId)
      if (!fromSession || !toSession || !fromNode || !toNode) continue
      if (fromNode.tierIndex >= toNode.tierIndex) continue
      const key = `${fromSessionId}->${toSessionId}`
      const kind: MainBracketLadderEdge["kind"] =
        labelLooksLikeLcq(fromSession.raceLabel) || labelLooksLikeLcq(toSession.raceLabel)
          ? "via_lcq"
          : "direct"
      const existing = edgesByKey.get(key)
      if (existing) {
        existing.driverCount += 1
      } else {
        edgesByKey.set(key, { fromSessionId, toSessionId, kind, driverCount: 1 })
      }
    }
  }
  return Array.from(edgesByKey.values())
}

export function buildMainBracketLadderModel(
  data: EventAnalysisData,
  className: string | null
): MainBracketLadderModel | null {
  const resolvedClass = className?.trim()
  if (!resolvedClass) return null

  const sessions = getSessionsForBumpUpInference(data, resolvedClass)
  const ladderSessions = sortSessionsForLadder(sessions.filter(isSessionMainForBumpUps))

  const rankedSessions: RankedSession[] = ladderSessions
    .map((session) => ({
      session,
      rank: getLadderRank(session.raceLabel, session.sessionType, session.sectionHeader),
    }))
    .filter((x): x is RankedSession => x.rank !== null)

  if (rankedSessions.length < 2) return null

  const fractionDenoms = rankedSessions
    .map(({ session }) => parseBracketFinalDenominator(session.raceLabel))
    .filter((d): d is number => d !== null)

  const maxFractionDenom = fractionDenoms.length > 0 ? Math.max(...fractionDenoms) : 0
  const maxFracLog = maxFractionDenom > 0 ? log2IntPow2(maxFractionDenom) : -1

  const nonFractionRankKeys = Array.from(
    new Set(
      rankedSessions
        .filter(({ session }) => parseBracketFinalDenominator(session.raceLabel) === null)
        .map(({ rank }) => tierKeyFromRank(rank))
    )
  ).sort((a, b) => a - b)

  let maxFractionColumnIndex = -1
  if (maxFractionDenom > 0) {
    const minD = Math.min(...fractionDenoms)
    maxFractionColumnIndex = log2IntPow2(maxFractionDenom) - log2IntPow2(minD)
  }

  const hasLcqRound = rankedSessions.some(({ session }) => labelLooksLikeLcq(session.raceLabel))
  // Reserve one bridge column between feeder rounds and the terminal fraction round (e.g. 1/1)
  // when LCQ exists, so LCQ never visually overlaps 1/2 Odd/Even lanes.
  const lcqBridgeColumn = hasLcqRound && maxFractionColumnIndex >= 0 ? maxFractionColumnIndex : null
  const shiftedMaxFractionColumnIndex =
    maxFractionColumnIndex >= 0 && lcqBridgeColumn !== null
      ? maxFractionColumnIndex + 1
      : maxFractionColumnIndex

  const nonFractionColumnByRankKey = new Map<number, number>()
  nonFractionRankKeys.forEach((key, idx) => {
    nonFractionColumnByRankKey.set(key, shiftedMaxFractionColumnIndex + 1 + idx)
  })

  function displayColumnForSession(session: RankedSession["session"], rank: number): number {
    const d = parseBracketFinalDenominator(session.raceLabel)
    if (d !== null && maxFractionDenom > 0) {
      const base = maxFracLog - log2IntPow2(d)
      return lcqBridgeColumn !== null && base >= lcqBridgeColumn ? base + 1 : base
    }
    if (lcqBridgeColumn !== null && labelLooksLikeLcq(session.raceLabel)) {
      return lcqBridgeColumn
    }
    return nonFractionColumnByRankKey.get(tierKeyFromRank(rank)) ?? 0
  }

  const lastRoundLabelByDriver = new Map<string, string>()
  const nodes: MainBracketLadderNode[] = []
  const nodesByColumn = new Map<number, MainBracketLadderNode[]>()
  const rowCounterByColumn = new Map<number, number>()

  for (const { session, rank } of rankedSessions) {
    const tierIndex = displayColumnForSession(session, rank)
    const baseBranch = branchForRace(session.raceLabel)
    const rowsInColumn = rowCounterByColumn.get(tierIndex) ?? 0
    rowCounterByColumn.set(tierIndex, rowsInColumn + 1)

    const branchInUse: BracketNodeBranch =
      baseBranch === "center" && rowsInColumn > 0 ? "stacked" : baseBranch
    const roundKind = describeMainLadderRound(session)
    const roundLabel = formatRoundLabel(session.raceLabel, roundKind)

    const seenInSession = new Set<string>()
    const drivers: BracketNodeDriver[] = session.results
      .filter((r) => {
        if (seenInSession.has(r.driverId)) return false
        seenInSession.add(r.driverId)
        return true
      })
      .map((r) => {
        const progressedFromRoundLabel = lastRoundLabelByDriver.get(r.driverId) ?? null
        const advancedFromPriorRound = progressedFromRoundLabel !== null
        return {
          driverId: r.driverId,
          driverName: r.driverName?.trim() || "Unknown Driver",
          position:
            typeof r.positionFinal === "number" && Number.isFinite(r.positionFinal)
              ? r.positionFinal
              : null,
          qualifyingPosition:
            typeof r.qualifyingPosition === "number" && Number.isFinite(r.qualifyingPosition)
              ? r.qualifyingPosition
              : null,
          lapsCompleted: r.lapsCompleted,
          totalTimeSeconds: r.totalTimeSeconds,
          advancedFromPriorRound,
          progressedFromRoundLabel,
        }
      })
      .sort((a, b) => {
        if (a.position !== null && b.position !== null && a.position !== b.position) {
          return a.position - b.position
        }
        if (a.position !== null && b.position === null) return -1
        if (a.position === null && b.position !== null) return 1
        return a.driverName.localeCompare(b.driverName, undefined, { sensitivity: "base" })
      })

    for (const driver of drivers) {
      lastRoundLabelByDriver.set(driver.driverId, roundLabel)
    }

    const node: MainBracketLadderNode = {
      sessionId: session.id,
      raceLabel: session.raceLabel,
      className: session.className,
      roundLabel,
      roundKind,
      raceOrder: session.raceOrder,
      branch: branchInUse,
      tierIndex,
      rowIndex: rowsInColumn,
      hasResults: session.results.length > 0,
      drivers,
      advancedDriverCount: drivers.filter((d) => d.advancedFromPriorRound).length,
      startTime: session.startTime,
    }
    nodes.push(node)
    const list = nodesByColumn.get(tierIndex) ?? []
    list.push(node)
    nodesByColumn.set(tierIndex, list)
  }

  nodes.sort((a, b) => {
    if (a.tierIndex !== b.tierIndex) return a.tierIndex - b.tierIndex
    if (a.raceOrder != null && b.raceOrder != null && a.raceOrder !== b.raceOrder) {
      return a.raceOrder - b.raceOrder
    }
    return a.raceLabel.localeCompare(b.raceLabel, undefined, { sensitivity: "base", numeric: true })
  })

  const edges = buildTransitionEdgesFromDriverPaths(rankedSessions, nodes)

  if (edges.length === 0) {
    const maxColumn = Math.max(...nodes.map((n) => n.tierIndex), 0)
    for (const node of nodes) {
      const nextCol = node.tierIndex + 1
      if (nextCol > maxColumn) continue
      const nextColumnNodes = nodesByColumn.get(nextCol) ?? []
      const target = edgeTargetForBranch(nextColumnNodes, node.branch)
      if (target) {
        const kind: MainBracketLadderEdge["kind"] =
          labelLooksLikeLcq(node.raceLabel) || labelLooksLikeLcq(target.raceLabel)
            ? "via_lcq"
            : "direct"
        edges.push({
          fromSessionId: node.sessionId,
          toSessionId: target.sessionId,
          kind,
          driverCount: null,
        })
      }
    }
  }

  return {
    className: resolvedClass,
    nodes,
    edges,
  }
}
