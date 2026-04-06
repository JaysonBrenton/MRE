import type { LiveRcRaceResultStats } from "./live-rc-race-result-stats"

/** Input shape for aggregating driver stats from event analysis races */
export type RaceInputForDriverStats = {
  raceLabel: string
  results: Array<{
    driverId: string
    driverName: string
    lapsCompleted: number
    fastLapTime: number | null
    avgLapTime: number | null
    consistency: number | null
    positionFinal: number
    liveRcStats?: LiveRcRaceResultStats | null
  }>
}

/** Output for charts; LiveRC extended stats are only set when exactly one race is in scope */
export type ComputedDriverStatsFromRaces = {
  driverId: string
  driverName: string
  bestLapTime: number | null
  bestLapRaceLabel: string | null
  avgLapTime: number | null
  averagePosition: number | null
  gapToFastest: number | null
  podiumFinishes: number
  averageConsistency: number | null
  avgTop5: number | null
  avgTop10: number | null
  avgTop15: number | null
  top2Consecutive: number | null
  top3Consecutive: number | null
  stdDeviation: number | null
}

function emptyLiveRcFields(): Pick<
  ComputedDriverStatsFromRaces,
  "avgTop5" | "avgTop10" | "avgTop15" | "top2Consecutive" | "top3Consecutive" | "stdDeviation"
> {
  return {
    avgTop5: null,
    avgTop10: null,
    avgTop15: null,
    top2Consecutive: null,
    top3Consecutive: null,
    stdDeviation: null,
  }
}

function pickLiveRc(
  s: LiveRcRaceResultStats | null | undefined
): ReturnType<typeof emptyLiveRcFields> {
  if (!s) {
    return emptyLiveRcFields()
  }
  return {
    avgTop5: s.avgTop5,
    avgTop10: s.avgTop10,
    avgTop15: s.avgTop15,
    top2Consecutive: s.top2Consecutive,
    top3Consecutive: s.top3Consecutive,
    stdDeviation: s.stdDeviation,
  }
}

/**
 * Compute driver stats from one or more races for chart display.
 * LiveRC `raw_fields_json` stats (avg top N, consecutive, std dev) are attached only when
 * `races.length === 1` (session scope); otherwise those fields are null.
 */
export function computeDriverStatsFromRaces(
  races: RaceInputForDriverStats[]
): ComputedDriverStatsFromRaces[] {
  const singleRaceLiveRc = races.length === 1

  const driverMap = new Map<
    string,
    {
      driverId: string
      driverName: string
      bestLapTime: number | null
      bestLapRaceLabel: string | null
      avgLapTimes: number[]
      positions: number[]
      consistencies: number[]
      /** Only used when singleRaceLiveRc */
      liveRcFromResult: LiveRcRaceResultStats | null
    }
  >()

  races.forEach((race) => {
    race.results.forEach((result) => {
      if (result.lapsCompleted === 0) return

      const driverId = result.driverId
      const driverName = result.driverName

      if (!driverMap.has(driverId)) {
        driverMap.set(driverId, {
          driverId,
          driverName,
          bestLapTime: null,
          bestLapRaceLabel: null,
          avgLapTimes: [],
          positions: [],
          consistencies: [],
          liveRcFromResult: null,
        })
      }

      const driverData = driverMap.get(driverId)!

      if (result.fastLapTime !== null) {
        if (driverData.bestLapTime === null || result.fastLapTime < driverData.bestLapTime) {
          driverData.bestLapTime = result.fastLapTime
          driverData.bestLapRaceLabel = race.raceLabel
        }
      }

      if (result.avgLapTime !== null) driverData.avgLapTimes.push(result.avgLapTime)
      if (result.consistency !== null) driverData.consistencies.push(result.consistency)
      driverData.positions.push(result.positionFinal)

      if (singleRaceLiveRc) {
        driverData.liveRcFromResult = result.liveRcStats ?? null
      }
    })
  })

  let fastestLapInClass: number | null = null
  for (const driver of driverMap.values()) {
    if (driver.bestLapTime !== null) {
      if (fastestLapInClass === null || driver.bestLapTime < fastestLapInClass) {
        fastestLapInClass = driver.bestLapTime
      }
    }
  }

  return Array.from(driverMap.values()).map((driver) => {
    const avgLapTime =
      driver.avgLapTimes.length > 0
        ? driver.avgLapTimes.reduce((a, b) => a + b, 0) / driver.avgLapTimes.length
        : null

    const averagePosition =
      driver.positions.length > 0
        ? driver.positions.reduce((a, b) => a + b, 0) / driver.positions.length
        : null

    const gapToFastest =
      driver.bestLapTime !== null && fastestLapInClass !== null
        ? driver.bestLapTime - fastestLapInClass
        : null

    const podiumFinishes = driver.positions.filter((pos) => pos >= 1 && pos <= 3).length

    const averageConsistency =
      driver.consistencies.length > 0
        ? driver.consistencies.reduce((a, b) => a + b, 0) / driver.consistencies.length
        : null

    const liverc = singleRaceLiveRc ? pickLiveRc(driver.liveRcFromResult) : emptyLiveRcFields()

    return {
      driverId: driver.driverId,
      driverName: driver.driverName,
      bestLapTime: driver.bestLapTime,
      bestLapRaceLabel: driver.bestLapRaceLabel,
      avgLapTime,
      averagePosition,
      gapToFastest,
      podiumFinishes,
      averageConsistency,
      ...liverc,
    }
  })
}
