/**
 * When LiveRC omits the Behind cell or ingestion did not persist `secondsBehind` /
 * `behindDisplay`, derive a gap from total race time vs the leader when both ran the
 * same lap count (same semantics as LiveRC elapsed gap for same-lap finishes).
 */

export type WithRaceBehindFields = {
  positionFinal: number
  lapsCompleted: number
  totalTimeSeconds: number | null
  secondsBehind: number | null
  behindDisplay?: string | null
}

function hasExplicitBehind(r: WithRaceBehindFields): boolean {
  if (r.secondsBehind != null && Number.isFinite(r.secondsBehind)) {
    return true
  }
  const raw = r.behindDisplay?.trim()
  return Boolean(raw)
}

export function withDerivedBehindSeconds<T extends WithRaceBehindFields>(results: T[]): T[] {
  if (results.length === 0) {
    return results
  }

  const leader = results.find((r) => r.positionFinal === 1)
  if (!leader || leader.lapsCompleted <= 0 || leader.totalTimeSeconds == null) {
    return results
  }

  const leaderLaps = leader.lapsCompleted
  const leaderTime = leader.totalTimeSeconds

  return results.map((r) => {
    if (r.positionFinal <= 1) {
      return r
    }
    if (hasExplicitBehind(r)) {
      return r
    }
    if (r.lapsCompleted !== leaderLaps) {
      return r
    }
    if (r.totalTimeSeconds == null) {
      return r
    }
    const gap = r.totalTimeSeconds - leaderTime
    if (!Number.isFinite(gap) || gap <= 0) {
      return r
    }
    return { ...r, secondsBehind: gap }
  })
}
