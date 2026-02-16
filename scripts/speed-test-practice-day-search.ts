/**
 * Performance test: practice day search flow (Canberra track).
 *
 * Times each step in the process:
 * 1. Event search with include_practice_days (Next.js → Prisma)
 * 2. Discover range (Next.js → Python per month, server-side fan-out)
 * 3. Per-month breakdown (when running discover range)
 *
 * Run: docker exec -it mre-app npx tsx scripts/speed-test-practice-day-search.ts
 *
 * Optional: TRACK_ID or pass track ID as first arg (default: Canberra).
 */

import { PrismaClient } from "@prisma/client"
import { searchEvents } from "../src/core/events/search-events"
import {
  discoverPracticeDays,
  discoverPracticeDaysRange,
} from "../src/core/practice-days/discover-practice-days"

const prisma = new PrismaClient()

const CANBERRA_TRACK_ID = "2aba913f-eb28-4b11-9f67-e9fdbdf52172"

function nowMs(): number {
  return performance.now()
}

function elapsedMs(start: number): number {
  return Math.round((performance.now() - start) * 100) / 100
}

function getMonthsBetween(
  startDateStr: string,
  endDateStr: string
): { year: number; month: number }[] {
  const start = new Date(startDateStr)
  const end = new Date(endDateStr)
  const months: { year: number; month: number }[] = []
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  const endFirst = new Date(end.getFullYear(), end.getMonth(), 1)
  while (cursor <= endFirst) {
    months.push({ year: cursor.getFullYear(), month: cursor.getMonth() + 1 })
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return months
}

async function main() {
  const trackId = process.argv[2] || process.env.TRACK_ID || CANBERRA_TRACK_ID

  const track = await prisma.track.findUnique({
    where: { id: trackId },
    select: { id: true, sourceTrackSlug: true, trackName: true },
  })
  if (!track) {
    console.error("Track not found:", trackId)
    process.exit(1)
  }

  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 90)
  const startDateStr = startDate.toISOString().slice(0, 10)
  const endDateStr = endDate.toISOString().slice(0, 10)

  const months = getMonthsBetween(startDateStr, endDateStr)
  const capped = months.length > 12 ? months.slice(-12) : months

  console.log("Practice day search performance test\n")
  console.log("Track:", track.trackName)
  console.log("  id:", track.id)
  console.log("  slug:", track.sourceTrackSlug)
  console.log("Range:", startDateStr, "..", endDateStr)
  console.log("Months in range:", months.length, "(capped at", capped.length, "for discover)")
  console.log("")

  const timings: { step: string; ms: number; detail?: string }[] = []

  // Step 1: Event search with include_practice_days
  console.log("Step 1: Event search (include_practice_days)...")
  const t1 = nowMs()
  const searchResult = await searchEvents({
    trackId: track.id,
    startDate: startDateStr,
    endDate: endDateStr,
    includePracticeDays: true,
  })
  const step1Ms = elapsedMs(t1)
  timings.push({
    step: "1. Event search (include_practice_days)",
    ms: step1Ms,
    detail: `events=${"events" in searchResult ? searchResult.events.length : 0}, practice_days=${"practiceDays" in searchResult ? searchResult.practiceDays.length : 0}`,
  })
  console.log(`   ${step1Ms}ms (${timings[0].detail})\n`)

  // Step 2: Full discover-range (single call – what the client does)
  console.log("Step 2: Discover range (single request, all months)...")
  const t2 = nowMs()
  const rangeResult = await discoverPracticeDaysRange({
    trackId: track.id,
    startDate: startDateStr,
    endDate: endDateStr,
    trackSlug: track.sourceTrackSlug,
  })
  const step2Ms = elapsedMs(t2)
  timings.push({
    step: "2. Discover range (single request, all months)",
    ms: step2Ms,
    detail: `practice_days=${rangeResult.practiceDays.length}`,
  })
  console.log(`   ${step2Ms}ms (${rangeResult.practiceDays.length} practice days)\n`)

  // Step 3: Per-month breakdown (same work as step 2, but timed per month)
  console.log("Step 3: Per-month discover breakdown (for diagnosis):\n")
  const monthTimings: { year: number; month: number; ms: number }[] = []
  for (const { year, month } of capped) {
    const t = nowMs()
    await discoverPracticeDays({
      trackId: track.id,
      year,
      month,
      trackSlug: track.sourceTrackSlug,
    })
    const ms = elapsedMs(t)
    monthTimings.push({ year, month, ms })
    const timeStr = ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`
    console.log(`   ${year}-${String(month).padStart(2, "0")}: ${timeStr}`)
  }
  const step3Total = monthTimings.reduce((s, m) => s + m.ms, 0)
  const step3Serial = monthTimings.length
  console.log("")
  timings.push({
    step: "3. Per-month total (if run serially)",
    ms: step3Total,
    detail: `${step3Serial} months, avg ${Math.round(step3Total / step3Serial)}ms/month`,
  })

  // Report
  console.log("--- Timings ---\n")
  for (const r of timings) {
    const timeStr = r.ms >= 1000 ? `${(r.ms / 1000).toFixed(2)}s` : `${r.ms}ms`
    console.log(`${r.step}`)
    console.log(`   ${timeStr}${r.detail ? ` (${r.detail})` : ""}`)
    console.log("")
  }

  const eventSearchMs = timings[0].ms
  const discoverRangeMs = timings[1].ms
  const totalUserWait = eventSearchMs + discoverRangeMs
  console.log("--- Summary ---")
  console.log(`Time to first paint (event search only): ${eventSearchMs >= 1000 ? `${(eventSearchMs / 1000).toFixed(2)}s` : `${eventSearchMs}ms`}`)
  console.log(`Time until practice days ready (event search + discover-range): ${totalUserWait >= 1000 ? `${(totalUserWait / 1000).toFixed(2)}s` : `${totalUserWait}ms`}`)
  if (totalUserWait > 0) {
    console.log(`Discover-range share: ${discoverRangeMs.toFixed(0)}ms of ${totalUserWait.toFixed(0)}ms (${Math.round((100 * discoverRangeMs) / totalUserWait)}%)`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => {
    prisma.$disconnect()
  })
