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
}

export interface MainBracketLadderModel {
  className: string
  nodes: MainBracketLadderNode[]
  edges: MainBracketLadderEdge[]
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

  const nonFractionColumnByRankKey = new Map<number, number>()
  nonFractionRankKeys.forEach((key, idx) => {
    nonFractionColumnByRankKey.set(key, maxFractionColumnIndex + 1 + idx)
  })

  function displayColumnForSession(session: RankedSession["session"], rank: number): number {
    const d = parseBracketFinalDenominator(session.raceLabel)
    if (d !== null && maxFractionDenom > 0) {
      return maxFracLog - log2IntPow2(d)
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

  const maxColumn = Math.max(...nodes.map((n) => n.tierIndex), 0)
  const edges: MainBracketLadderEdge[] = []
  for (const node of nodes) {
    const nextCol = node.tierIndex + 1
    if (nextCol > maxColumn) continue
    const nextColumnNodes = nodesByColumn.get(nextCol) ?? []
    const target = edgeTargetForBranch(nextColumnNodes, node.branch)
    if (target) {
      edges.push({ fromSessionId: node.sessionId, toSessionId: target.sessionId })
    }
  }

  const lcqNodes = nodes.filter((n) => labelLooksLikeLcq(n.raceLabel))
  for (const lcqNode of lcqNodes) {
    const alreadyHas = edges.some((e) => e.fromSessionId === lcqNode.sessionId)
    if (alreadyHas) continue
    const higher = nodes
      .filter((n) => n.tierIndex > lcqNode.tierIndex)
      .sort((a, b) => a.tierIndex - b.tierIndex)[0]
    if (higher) {
      edges.push({ fromSessionId: lcqNode.sessionId, toSessionId: higher.sessionId })
    }
  }

  return {
    className: resolvedClass,
    nodes,
    edges,
  }
}
