/**
 * @fileoverview Script to backfill EventEntry records for events that are missing them
 * 
 * This script finds events that have been ingested but are missing EventEntry records,
 * and triggers re-processing of the entry list to create them.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Finding events missing EventEntry records...\n')

  // Find all events
  const events = await prisma.event.findMany({
    include: {
      _count: {
        select: {
          entries: true,
        },
      },
    },
  })

  const eventsMissingEntries: Array<{ id: string; name: string; entries: number; metadataEntries: number }> = []

  for (const event of events) {
    const actualEntryCount = event._count.entries
    const metadataEntryCount = event.eventEntries || 0

    if (actualEntryCount === 0 && metadataEntryCount > 0) {
      eventsMissingEntries.push({
        id: event.id,
        name: event.eventName,
        entries: actualEntryCount,
        metadataEntries: metadataEntryCount,
      })
    }
  }

  if (eventsMissingEntries.length === 0) {
    console.log('✅ All events have EventEntry records or no entries in metadata.')
    return
  }

  console.log(`Found ${eventsMissingEntries.length} event(s) missing EventEntry records:\n`)
  eventsMissingEntries.forEach((e) => {
    console.log(`  - ${e.name}`)
    console.log(`    ID: ${e.id}`)
    console.log(`    Metadata shows ${e.metadataEntries} entries, but 0 EventEntry records exist`)
    console.log('')
  })

  console.log('\n⚠️  To fix this, you need to:')
  console.log('   1. Reset the event ingest_depth to "none"')
  console.log('   2. Re-ingest the event (this will create EventEntry records)')
  console.log('   3. Or use the ingestion API/CLI to trigger re-ingestion\n')

  // Optionally reset ingest_depth for these events
  const resetFlag = process.argv.includes('--reset')
  if (resetFlag) {
    console.log('Resetting ingest_depth to "none" for these events...\n')
    for (const event of eventsMissingEntries) {
      await prisma.event.update({
        where: { id: event.id },
        data: { ingestDepth: 'none' },
      })
      console.log(`✅ Reset ingest_depth for: ${event.name}`)
    }
    console.log('\n✅ Done! You can now re-ingest these events.')
  } else {
    console.log('💡 Tip: Run with --reset flag to automatically reset ingest_depth for these events')
  }
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

