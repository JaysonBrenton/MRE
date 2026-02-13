/**
 * Indicative speed test: event search vs practice search (and discover).
 *
 * Measures elapsed time for:
 * 1. Event search (Next.js → Prisma → DB only)
 * 2. Practice search (Next.js → Python → DB)
 * 3. Event discover (Next.js → Python → LiveRC, 1 page)
 * 4. Practice discover (Next.js → Python → LiveRC, 1+N pages)
 *
 * Run inside Docker (app + ingestion service must be running):
 *   docker exec -it mre-app npx tsx scripts/speed-test-search.ts [trackId]
 *
 * Optional env: TRACK_ID, START_DATE, END_DATE, YEAR, MONTH
 * Default: first active track, current month for dates.
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const INGESTION_SERVICE_URL =
  process.env.INGESTION_SERVICE_URL || "http://liverc-ingestion-service:8000"

function nowMs(): number {
  return performance.now()
}

function elapsedMs(start: number): number {
  return Math.round((performance.now() - start) * 100) / 100
}

async function getTrack(trackId?: string): Promise<{ id: string; sourceTrackSlug: string; trackName: string }> {
  const track = trackId
    ? await prisma.track.findUnique({
        where: { id: trackId },
        select: { id: true, sourceTrackSlug: true, trackName: true },
      })
    : await prisma.track.findFirst({
        where: { isActive: true },
        select: { id: true, sourceTrackSlug: true, trackName: true },
        orderBy: { trackName: "asc" },
      })

  if (!track) {
    throw new Error(trackId ? `Track not found: ${trackId}` : "No active track found in database")
  }
  return track
}

async function runEventSearch(trackId: string, startDate: string, endDate: string): Promise<number> {
  const { searchEvents } = await import("../src/core/events/search-events")
  const start = nowMs()
  await searchEvents({
    trackId,
    startDate,
    endDate,
  })
  return elapsedMs(start)
}

async function runPracticeSearch(
  trackId: string,
  startDate: string,
  endDate: string
): Promise<number> {
  const url = `${INGESTION_SERVICE_URL}/api/v1/practice-days/search?track_id=${encodeURIComponent(trackId)}&start_date=${startDate}&end_date=${endDate}`
  const start = nowMs()
  const res = await fetch(url, { method: "GET", headers: { "Content-Type": "application/json" } })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Practice search failed ${res.status}: ${err}`)
  }
  await res.json()
  return elapsedMs(start)
}

async function runEventDiscover(trackSlug: string, startDate?: string, endDate?: string): Promise<number> {
  const url = `${INGESTION_SERVICE_URL}/api/v1/events/discover`
  const body: { track_slug: string; start_date?: string; end_date?: string } = { track_slug: trackSlug }
  if (startDate) body.start_date = startDate
  if (endDate) body.end_date = endDate
  const start = nowMs()
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Event discover failed ${res.status}: ${err}`)
  }
  await res.json()
  return elapsedMs(start)
}

async function runPracticeDiscover(
  trackSlug: string,
  year: number,
  month: number
): Promise<number> {
  const url = `${INGESTION_SERVICE_URL}/api/v1/practice-days/discover`
  const start = nowMs()
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ track_slug: trackSlug, year, month }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Practice discover failed ${res.status}: ${err}`)
  }
  await res.json()
  return elapsedMs(start)
}

function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`
  return `${ms}ms`
}

async function main() {
  const trackIdArg = process.argv[2] || process.env.TRACK_ID
  const startDate = process.env.START_DATE ?? new Date().toISOString().slice(0, 10)
  const endDate = process.env.END_DATE ?? startDate
  const year = process.env.YEAR ? parseInt(process.env.YEAR, 10) : new Date().getFullYear()
  const month = process.env.MONTH ? parseInt(process.env.MONTH, 10) : new Date().getMonth() + 1

  console.log("Speed test: event search vs practice search\n")
  console.log("Config:")
  console.log("  INGESTION_SERVICE_URL:", INGESTION_SERVICE_URL)
  console.log("  Date range:", startDate, "..", endDate)
  console.log("  Practice month:", year, "-", month)
  console.log("")

  const track = await getTrack(trackIdArg)
  console.log("Track:", track.trackName)
  console.log("  id:", track.id)
  console.log("  slug:", track.sourceTrackSlug)
  console.log("")

  const results: { name: string; ms: number; error?: string }[] = []

  // 1. Event search (in-app DB only)
  try {
    const ms = await runEventSearch(track.id, startDate, endDate)
    results.push({ name: "Event search (Next.js → Prisma → DB)", ms })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    results.push({ name: "Event search (Next.js → Prisma → DB)", ms: 0, error: msg })
  }

  // 2. Practice search (Next.js → Python → DB)
  try {
    const ms = await runPracticeSearch(track.id, startDate, endDate)
    results.push({ name: "Practice search (Next.js → Python → DB)", ms })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    results.push({ name: "Practice search (Next.js → Python → DB)", ms: 0, error: msg })
  }

  // 3. Event discover (Python → LiveRC, 1 page)
  try {
    const ms = await runEventDiscover(track.sourceTrackSlug, startDate, endDate)
    results.push({ name: "Event discover (Python → LiveRC, 1 page)", ms })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    results.push({ name: "Event discover (Python → LiveRC, 1 page)", ms: 0, error: msg })
  }

  // 4. Practice discover (Python → LiveRC, 1+N pages)
  try {
    const ms = await runPracticeDiscover(track.sourceTrackSlug, year, month)
    results.push({ name: "Practice discover (Python → LiveRC, 1+N pages)", ms })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    results.push({ name: "Practice discover (Python → LiveRC, 1+N pages)", ms: 0, error: msg })
  }

  // Report
  const nameWidth = Math.max(...results.map((r) => r.name.length), 20)
  console.log("Results (indicative):")
  console.log("-".repeat(nameWidth + 16))
  for (const r of results) {
    const timeStr = r.error ? `ERROR` : formatMs(r.ms)
    console.log(`${r.name.padEnd(nameWidth)}  ${timeStr}`)
    if (r.error) console.log(`  ${r.error}`)
  }
  console.log("-".repeat(nameWidth + 16))

  const eventSearch = results.find((r) => r.name.startsWith("Event search ("))
  const practiceSearch = results.find((r) => r.name.startsWith("Practice search ("))
  const practiceDiscover = results.find((r) => r.name.startsWith("Practice discover ("))
  if (eventSearch?.ms && practiceSearch?.ms) {
    const ratio = (practiceSearch.ms / eventSearch.ms).toFixed(1)
    console.log(`\nPractice search vs event search: ${ratio}x slower (same DB list, practice goes via Python)`)
  }
  if (eventSearch?.ms && practiceDiscover?.ms) {
    const ratio = (practiceDiscover.ms / eventSearch.ms).toFixed(1)
    console.log(`Practice discover vs event search: ${ratio}x slower (many LiveRC requests)`)
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
