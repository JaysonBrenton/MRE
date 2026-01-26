/**
 * Test script to validate event import process
 * 
 * Usage: docker exec -it mre-app npx ts-node scripts/test-event-import.ts "Kings Cup 2025 Re-Rerun 06-12-2025"
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface ImportResult {
  success: boolean
  event_id?: string
  ingest_depth?: string
  races_ingested?: number
  results_ingested?: number
  laps_ingested?: number
  status?: string
  message?: string
}

async function findEvent(eventName: string) {
  const events = await prisma.event.findMany({
    where: {
      eventName: {
        contains: eventName,
        mode: 'insensitive'
      }
    },
    include: {
      track: {
        select: {
          id: true,
          trackName: true,
          sourceTrackSlug: true,
          source: true
        }
      }
    },
    orderBy: {
      eventDate: 'desc'
    }
  })

  return events
}

async function importEventBySourceId(sourceEventId: string, trackId: string): Promise<ImportResult> {
  const baseUrl = process.env.APP_URL || 'http://localhost:3001'
  const url = `${baseUrl}/api/v1/events/ingest`
  
  console.log(`\n📤 Calling import API: ${url}`)
  console.log(`   source_event_id: ${sourceEventId}`)
  console.log(`   track_id: ${trackId}`)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source_event_id: sourceEventId,
        track_id: trackId,
        depth: 'laps_full'
      }),
    })

    const data = await response.json()
    
    if (!response.ok) {
      console.error(`❌ Import failed: ${data.error?.message || data.message || 'Unknown error'}`)
      return {
        success: false,
        message: data.error?.message || data.message || 'Unknown error'
      }
    }

    if (data.success === false) {
      console.error(`❌ Import failed: ${data.error?.message || 'Unknown error'}`)
      return {
        success: false,
        message: data.error?.message || 'Unknown error'
      }
    }

    const result = data.data || data
    console.log(`✅ Import response received:`)
    console.log(`   Event ID: ${result.event_id}`)
    console.log(`   Ingest Depth: ${result.ingest_depth}`)
    console.log(`   Status: ${result.status}`)
    if (result.races_ingested !== undefined) {
      console.log(`   Races: ${result.races_ingested}`)
    }
    if (result.results_ingested !== undefined) {
      console.log(`   Results: ${result.results_ingested}`)
    }
    if (result.laps_ingested !== undefined) {
      console.log(`   Laps: ${result.laps_ingested}`)
    }

    return {
      success: true,
      event_id: result.event_id,
      ingest_depth: result.ingest_depth,
      races_ingested: result.races_ingested,
      results_ingested: result.results_ingested,
      laps_ingested: result.laps_ingested,
      status: result.status
    }
  } catch (error) {
    console.error(`❌ Import request failed:`, error instanceof Error ? error.message : String(error))
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error)
    }
  }
}

async function importEventById(eventId: string): Promise<ImportResult> {
  const baseUrl = process.env.APP_URL || 'http://localhost:3001'
  const url = `${baseUrl}/api/v1/events/${eventId}/ingest`
  
  console.log(`\n📤 Calling import API: ${url}`)
  console.log(`   event_id: ${eventId}`)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        depth: 'laps_full'
      }),
    })

    const data = await response.json()
    
    if (!response.ok) {
      console.error(`❌ Import failed: ${data.error?.message || data.message || 'Unknown error'}`)
      return {
        success: false,
        message: data.error?.message || data.message || 'Unknown error'
      }
    }

    if (data.success === false) {
      console.error(`❌ Import failed: ${data.error?.message || 'Unknown error'}`)
      return {
        success: false,
        message: data.error?.message || 'Unknown error'
      }
    }

    const result = data.data || data
    console.log(`✅ Import response received:`)
    console.log(`   Event ID: ${result.event_id}`)
    console.log(`   Ingest Depth: ${result.ingest_depth}`)
    console.log(`   Status: ${result.status}`)
    if (result.races_ingested !== undefined) {
      console.log(`   Races: ${result.races_ingested}`)
    }
    if (result.results_ingested !== undefined) {
      console.log(`   Results: ${result.results_ingested}`)
    }
    if (result.laps_ingested !== undefined) {
      console.log(`   Laps: ${result.laps_ingested}`)
    }

    return {
      success: true,
      event_id: result.event_id,
      ingest_depth: result.ingest_depth,
      races_ingested: result.races_ingested,
      results_ingested: result.results_ingested,
      laps_ingested: result.laps_ingested,
      status: result.status
    }
  } catch (error) {
    console.error(`❌ Import request failed:`, error instanceof Error ? error.message : String(error))
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error)
    }
  }
}

async function checkEventStatus(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      eventName: true,
      ingestDepth: true,
      lastIngestedAt: true,
      sourceEventId: true,
    }
  })

  if (!event) {
    return null
  }

  // Count races, results, and laps separately
  const raceCount = await prisma.race.count({
    where: { eventId }
  })

  const resultCount = await prisma.raceResult.count({
    where: {
      race: {
        eventId
      }
    }
  })

  const lapCount = await prisma.lap.count({
    where: {
      raceResult: {
        race: {
          eventId
        }
      }
    }
  })

  return {
    id: event.id,
    name: event.eventName,
    ingestDepth: event.ingestDepth,
    lastIngestedAt: event.lastIngestedAt,
    sourceEventId: event.sourceEventId,
    counts: {
      races: raceCount,
      results: resultCount,
      laps: lapCount
    }
  }
}

async function waitForImport(eventId: string, maxWaitSeconds: number = 300) {
  console.log(`\n⏳ Waiting for import to complete (max ${maxWaitSeconds}s)...`)
  
  const startTime = Date.now()
  const checkInterval = 5000 // Check every 5 seconds
  
  while (Date.now() - startTime < maxWaitSeconds * 1000) {
    await new Promise(resolve => setTimeout(resolve, checkInterval))
    
    const status = await checkEventStatus(eventId)
    if (!status) {
      console.log(`   ⚠️  Event not found in database`)
      continue
    }

    console.log(`   Status: ${status.ingestDepth || 'none'}`)
    console.log(`   Counts: ${status.counts.races} races, ${status.counts.results} results, ${status.counts.laps} laps`)
    
    if (status.ingestDepth === 'laps_full' && status.lastIngestedAt) {
      console.log(`\n✅ Import completed successfully!`)
      console.log(`   Event ID: ${status.id}`)
      console.log(`   Event Name: ${status.name}`)
      console.log(`   Ingest Depth: ${status.ingestDepth}`)
      console.log(`   Last Ingested: ${status.lastIngestedAt.toISOString()}`)
      console.log(`   Final Counts:`)
      console.log(`     Races: ${status.counts.races}`)
      console.log(`     Results: ${status.counts.results}`)
      console.log(`     Laps: ${status.counts.laps}`)
      return true
    }
  }

  console.log(`\n⏱️  Timeout waiting for import to complete`)
  const finalStatus = await checkEventStatus(eventId)
  if (finalStatus) {
    console.log(`   Final Status: ${finalStatus.ingestDepth || 'none'}`)
    console.log(`   Final Counts: ${finalStatus.counts.races} races, ${finalStatus.counts.results} results, ${finalStatus.counts.laps} laps`)
  }
  return false
}

async function main() {
  const eventName = process.argv[2] || 'Kings Cup 2025 Re-Rerun 06-12-2025'
  const sourceEventId = process.argv[3] // Optional: source_event_id for LiveRC events
  const trackId = process.argv[4] // Optional: track_id for LiveRC events
  
  console.log(`\n🔍 Testing event import for: "${eventName}"`)
  console.log(`   APP_URL: ${process.env.APP_URL || 'http://localhost:3001'}`)
  
  // Step 1: Find the event
  console.log(`\n📋 Step 1: Searching for event in database...`)
  const events = await findEvent(eventName)
  
  if (events.length === 0) {
    console.log(`⚠️  Event not found in database.`)
    
    // If source_event_id and track_id are provided, we can import directly
    if (sourceEventId && trackId) {
      console.log(`\n📋 Using provided source_event_id and track_id for direct import...`)
      console.log(`   source_event_id: ${sourceEventId}`)
      console.log(`   track_id: ${trackId}`)
      
      const importResult = await importEventBySourceId(sourceEventId, trackId)
      
      if (importResult.success && importResult.event_id) {
        console.log(`\n✅ Import initiated successfully!`)
        await waitForImport(importResult.event_id)
        
        // Final status check
        const finalStatus = await checkEventStatus(importResult.event_id)
        if (finalStatus) {
          console.log(`\n📋 Final status:`)
          console.log(`   Event ID: ${finalStatus.id}`)
          console.log(`   Event Name: ${finalStatus.name}`)
          console.log(`   Ingest Depth: ${finalStatus.ingestDepth || 'none'}`)
          console.log(`   Last Ingested: ${finalStatus.lastIngestedAt?.toISOString() || '(never)'}`)
          console.log(`   Final Counts:`)
          console.log(`     Races: ${finalStatus.counts.races}`)
          console.log(`     Results: ${finalStatus.counts.results}`)
          console.log(`     Laps: ${finalStatus.counts.laps}`)
          
          if (finalStatus.ingestDepth === 'laps_full' && finalStatus.lastIngestedAt) {
            console.log(`\n✅ VALIDATION SUCCESS: Event import process is working correctly!`)
          } else {
            console.log(`\n⚠️  VALIDATION WARNING: Import may not be fully complete`)
          }
        }
      } else {
        console.log(`\n❌ Import failed`)
        if (importResult?.message) {
          console.log(`   Error: ${importResult.message}`)
        }
        await prisma.$disconnect()
        process.exit(1)
      }
      
      await prisma.$disconnect()
      return
    } else {
      console.log(`\n   To import this event directly, provide source_event_id and track_id:`)
      console.log(`   Usage: npx tsx scripts/test-event-import.ts "${eventName}" <source_event_id> <track_id>`)
      console.log(`\n   Or use the event discovery feature in the UI to find this event first.`)
      await prisma.$disconnect()
      process.exit(1)
    }
  }

  console.log(`✅ Found ${events.length} matching event(s):`)
  events.forEach((event, index) => {
    console.log(`\n   ${index + 1}. ${event.eventName}`)
    console.log(`      ID: ${event.id}`)
    console.log(`      Source Event ID: ${event.sourceEventId || '(none)'}`)
    console.log(`      Track: ${event.track.trackName} (${event.track.sourceTrackSlug})`)
    console.log(`      Track ID: ${event.trackId}`)
    console.log(`      Date: ${event.eventDate?.toISOString().split('T')[0] || '(none)'}`)
    console.log(`      Current Ingest Depth: ${event.ingestDepth || 'none'}`)
    console.log(`      Last Ingested: ${event.lastIngestedAt?.toISOString() || '(never)'}`)
  })

  // Use the first matching event
  const event = events[0]
  console.log(`\n📋 Using event: ${event.eventName}`)

  // Step 2: Check current status
  console.log(`\n📋 Step 2: Checking current import status...`)
  const currentStatus = await checkEventStatus(event.id)
  if (currentStatus) {
    console.log(`   Ingest Depth: ${currentStatus.ingestDepth || 'none'}`)
    console.log(`   Last Ingested: ${currentStatus.lastIngestedAt?.toISOString() || '(never)'}`)
    console.log(`   Current Counts:`)
    console.log(`     Races: ${currentStatus.counts.races}`)
    console.log(`     Results: ${currentStatus.counts.results}`)
    console.log(`     Laps: ${currentStatus.counts.laps}`)
  }

  // Step 3: Determine import method
  console.log(`\n📋 Step 3: Determining import method...`)
  let importResult: ImportResult | null = null

  if (event.id.startsWith('liverc-') || !event.sourceEventId) {
    // This is a LiveRC-only event or missing sourceEventId
    if (!event.sourceEventId) {
      console.log(`❌ Cannot import: Event is missing sourceEventId`)
      console.log(`   This event may need to be re-discovered from LiveRC.`)
      await prisma.$disconnect()
      process.exit(1)
    }
    
    console.log(`   Using source_event_id import method (LiveRC event)`)
    importResult = await importEventBySourceId(event.sourceEventId, event.trackId)
  } else {
    // This is an existing event in the database
    console.log(`   Using event_id import method (existing event)`)
    importResult = await importEventById(event.id)
  }

  // Step 4: Check result
  if (!importResult || !importResult.success) {
    console.log(`\n❌ Import failed`)
    if (importResult?.message) {
      console.log(`   Error: ${importResult.message}`)
    }
    await prisma.$disconnect()
    process.exit(1)
  }

  // Step 5: Wait for import to complete (if status indicates it's in progress)
  if (importResult.status === 'in_progress' || importResult.status === 'updated') {
    const eventIdToCheck = importResult.event_id || event.id
    await waitForImport(eventIdToCheck)
  } else if (importResult.status === 'already_complete') {
    console.log(`\n✅ Import already complete`)
  } else {
    console.log(`\n✅ Import completed immediately`)
  }

  // Step 6: Final status check
  console.log(`\n📋 Step 6: Final status check...`)
  const finalEventId = importResult.event_id || event.id
  const finalStatus = await checkEventStatus(finalEventId)
  if (finalStatus) {
    console.log(`   Event ID: ${finalStatus.id}`)
    console.log(`   Event Name: ${finalStatus.name}`)
    console.log(`   Ingest Depth: ${finalStatus.ingestDepth || 'none'}`)
    console.log(`   Last Ingested: ${finalStatus.lastIngestedAt?.toISOString() || '(never)'}`)
    console.log(`   Final Counts:`)
    console.log(`     Races: ${finalStatus.counts.races}`)
    console.log(`     Results: ${finalStatus.counts.results}`)
    console.log(`     Laps: ${finalStatus.counts.laps}`)
    
    if (finalStatus.ingestDepth === 'laps_full' && finalStatus.lastIngestedAt) {
      console.log(`\n✅ VALIDATION SUCCESS: Event import process is working correctly!`)
    } else {
      console.log(`\n⚠️  VALIDATION WARNING: Import may not be fully complete`)
      console.log(`   Expected: ingestDepth='laps_full' with lastIngestedAt set`)
      console.log(`   Actual: ingestDepth='${finalStatus.ingestDepth || 'none'}'`)
    }
  } else {
    console.log(`❌ Event not found after import`)
  }

  await prisma.$disconnect()
}

main()
  .catch((error) => {
    console.error('\n❌ Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
