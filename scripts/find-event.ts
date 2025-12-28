import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const searchTerm = process.argv[2] || 'Cormcc'
  
  const events = await prisma.event.findMany({
    where: {
      eventName: {
        contains: searchTerm,
        mode: 'insensitive'
      }
    },
    include: {
      track: {
        select: {
          trackName: true,
          sourceTrackSlug: true
        }
      }
    }
  })
  
  if (events.length === 0) {
    console.log(`No events found matching "${searchTerm}"`)
    return
  }
  
  console.log(`Found ${events.length} event(s):\n`)
  events.forEach(event => {
    console.log(`Event: ${event.eventName}`)
    console.log(`  ID: ${event.id}`)
    console.log(`  Source ID: ${event.sourceEventId}`)
    console.log(`  Track: ${event.track.trackName} (${event.track.sourceTrackSlug})`)
    console.log(`  Track ID: ${event.trackId}`)
    console.log(`  Date: ${event.eventDate.toISOString().split('T')[0]}`)
    console.log(`  Ingest Depth: ${event.ingestDepth}`)
    console.log('')
  })
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect()
  })

