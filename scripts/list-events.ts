import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function formatTableRow(columns: string[], widths: number[]): string {
  return columns.map((col, i) => col.padEnd(widths[i])).join(' | ')
}

async function main() {
  const trackId = process.argv.find(arg => arg.startsWith('--track-id'))?.split('=')[1] || 
                  process.argv[process.argv.indexOf('--track-id') + 1]

  if (!trackId) {
    console.error('Error: --track-id is required')
    console.error('Usage: ts-node scripts/list-events.ts --track-id <track-id>')
    process.exit(1)
  }

  // First, verify the track exists
  const track = await prisma.track.findUnique({
    where: { id: trackId },
    select: {
      id: true,
      trackName: true,
      sourceTrackSlug: true,
      source: true,
      isActive: true,
      isFollowed: true,
    },
  })

  if (!track) {
    console.error(`Error: Track with ID ${trackId} not found`)
    process.exit(1)
  }

  console.log(`\nTrack: ${track.trackName}`)
  console.log(`ID: ${track.id}`)
  console.log(`Slug: ${track.sourceTrackSlug}`)
  console.log(`Source: ${track.source}`)
  console.log(`Active: ${track.isActive ? 'Yes' : 'No'}`)
  console.log(`Followed: ${track.isFollowed ? 'Yes' : 'No'}`)
  console.log('')

  // Get events for this track
  const events = await prisma.event.findMany({
    where: { trackId },
    include: {
      _count: {
        select: {
          races: true,
        },
      },
    },
    orderBy: {
      eventDate: 'desc',
    },
  })

  if (events.length === 0) {
    console.log('No events found for this track.')
    return
  }

  // Calculate column widths
  const eventNameWidth = Math.max(
    'Event Name'.length,
    ...events.map((e) => e.eventName.length)
  )
  const dateWidth = Math.max('Date'.length, 10)
  const entriesWidth = Math.max('Entries'.length, 7)
  const driversWidth = Math.max('Drivers'.length, 7)
  const racesWidth = Math.max('Races'.length, 6)
  const ingestDepthWidth = Math.max('Ingest Depth'.length, 12)
  const lastIngestedWidth = Math.max('Last Ingested'.length, 19)
  const sourceIdWidth = Math.max('Source ID'.length, Math.max(...events.map((e) => e.sourceEventId.length)))

  const widths = [
    eventNameWidth,
    dateWidth,
    entriesWidth,
    driversWidth,
    racesWidth,
    ingestDepthWidth,
    lastIngestedWidth,
    sourceIdWidth,
  ]

  // Header
  console.log(formatTableRow(
    ['Event Name', 'Date', 'Entries', 'Drivers', 'Races', 'Ingest Depth', 'Last Ingested', 'Source ID'],
    widths
  ))
  console.log(formatTableRow(
    [
      '-'.repeat(eventNameWidth),
      '-'.repeat(dateWidth),
      '-'.repeat(entriesWidth),
      '-'.repeat(driversWidth),
      '-'.repeat(racesWidth),
      '-'.repeat(ingestDepthWidth),
      '-'.repeat(lastIngestedWidth),
      '-'.repeat(sourceIdWidth),
    ],
    widths
  ))

  // Rows
  events.forEach((event) => {
    const date = event.eventDate.toISOString().split('T')[0]
    const lastIngested = event.lastIngestedAt
      ? event.lastIngestedAt.toISOString().split('T')[0]
      : 'Never'
    const ingestDepth = event.ingestDepth

    console.log(
      formatTableRow(
        [
          event.eventName,
          date,
          event.eventEntries.toString(),
          event.eventDrivers.toString(),
          event._count.races.toString(),
          ingestDepth,
          lastIngested,
          event.sourceEventId,
        ],
        widths
      )
    )
  })

  console.log(`\nTotal: ${events.length} event(s)`)
}

main()
  .catch((e) => {
    console.error('Error querying database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

