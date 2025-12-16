import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function formatTableRow(columns: string[], widths: number[]): string {
  return columns.map((col, i) => col.padEnd(widths[i])).join(' | ')
}

async function main() {
  const tracks = await prisma.track.findMany({
    include: {
      _count: {
        select: {
          events: true,
        },
      },
    },
    orderBy: {
      trackName: 'asc',
    },
  })

  // Calculate column widths
  const trackNameWidth = Math.max(
    'Track Name'.length,
    ...tracks.map((t) => t.trackName.length)
  )
  const slugWidth = Math.max(
    'Slug'.length,
    ...tracks.map((t) => t.sourceTrackSlug.length)
  )
  const sourceWidth = Math.max('Source'.length, 6)
  const activeWidth = Math.max('Active'.length, 6)
  const followedWidth = Math.max('Followed'.length, 8)
  const eventsWidth = Math.max('Events'.length, 6)
  const lastSeenWidth = Math.max('Last Seen'.length, 19)

  const widths = [
    trackNameWidth,
    slugWidth,
    sourceWidth,
    activeWidth,
    followedWidth,
    eventsWidth,
    lastSeenWidth,
  ]

  // Header
  console.log(formatTableRow(['Track Name', 'Slug', 'Source', 'Active', 'Followed', 'Events', 'Last Seen'], widths))
  console.log(formatTableRow(
    ['-'.repeat(trackNameWidth), '-'.repeat(slugWidth), '-'.repeat(sourceWidth), '-'.repeat(activeWidth), '-'.repeat(followedWidth), '-'.repeat(eventsWidth), '-'.repeat(lastSeenWidth)],
    widths
  ))

  // Rows
  tracks.forEach((track) => {
    const lastSeen = track.lastSeenAt
      ? track.lastSeenAt.toISOString().split('T')[0]
      : 'Never'
    const active = track.isActive ? 'Yes' : 'No'
    const followed = track.isFollowed ? 'Yes' : 'No'
    const events = track._count.events.toString()

    console.log(
      formatTableRow(
        [
          track.trackName,
          track.sourceTrackSlug,
          track.source,
          active,
          followed,
          events,
          lastSeen,
        ],
        widths
      )
    )
  })

  console.log(`\nTotal: ${tracks.length} tracks`)
}

main()
  .catch((e) => {
    console.error('Error querying database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

