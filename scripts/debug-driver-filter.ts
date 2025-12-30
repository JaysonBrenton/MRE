/**
 * Debug script to check driver filtering logic
 * 
 * Run with: npx ts-node --compiler-options '{"module":"commonjs"}' scripts/debug-driver-filter.ts
 */

import { PrismaClient } from "@prisma/client"
import { findUserById } from "../src/core/users/repo"
import { fuzzyMatchUserToDriver } from "../src/core/users/driver-matcher"

const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2] || "jaysoncareybrenton@gmail.com"
  
  console.log(`\n=== Debugging Driver Filter for: ${email} ===\n`)
  
  // Find user
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      driverName: true,
      normalizedName: true,
      transponderNumber: true,
    },
  })
  
  if (!user) {
    console.error(`User not found: ${email}`)
    process.exit(1)
  }
  
  console.log(`User found:`)
  console.log(`  ID: ${user.id}`)
  console.log(`  Driver Name: ${user.driverName}`)
  console.log(`  Normalized Name: ${user.normalizedName || "(not set)"}`)
  console.log(`  Transponder: ${user.transponderNumber || "(not set)"}`)
  
  // Get all EventDriverLinks for this user
  const eventDriverLinks = await prisma.eventDriverLink.findMany({
    where: {
      userId: user.id,
      NOT: {
        userDriverLink: {
          status: "rejected",
        },
      },
    },
    select: {
      id: true,
      eventId: true,
      driverId: true,
      matchType: true,
      similarityScore: true,
      driver: {
        select: {
          id: true,
          displayName: true,
          normalizedName: true,
          transponderNumber: true,
        },
      },
      event: {
        select: {
          id: true,
          eventName: true,
          eventDate: true,
        },
      },
      userDriverLink: {
        select: {
          id: true,
          status: true,
          similarityScore: true,
        },
      },
    },
    take: 20, // Limit to first 20 for debugging
  })
  
  console.log(`\n=== EventDriverLinks (showing first 20) ===`)
  console.log(`Total EventDriverLinks: ${eventDriverLinks.length}\n`)
  
  const verifiedMatches: string[] = []
  const rejectedMatches: string[] = []
  
  for (const link of eventDriverLinks) {
    // Verify the driver matches
    const match = fuzzyMatchUserToDriver(
      {
        id: user.id,
        driverName: user.driverName,
        normalizedName: user.normalizedName,
        transponderNumber: user.transponderNumber,
      },
      {
        id: link.driver.id,
        displayName: link.driver.displayName,
        normalizedName: link.driver.normalizedName,
        transponderNumber: link.driver.transponderNumber,
      }
    )
    
    const isHighConfidenceMatch = match && (
      match.matchType === "transponder" || 
      match.matchType === "exact" || 
      (match.matchType === "fuzzy" && match.status === "confirmed")
    )
    
    const status = isHighConfidenceMatch ? "✓ VERIFIED" : "✗ REJECTED"
    const matchInfo = match 
      ? `${match.matchType} (${match.similarityScore.toFixed(3)}, ${match.status})`
      : "NO MATCH"
    
    console.log(`${status} - Event: ${link.event.eventName}`)
    console.log(`  Event ID: ${link.event.id}`)
    console.log(`  Driver: ${link.driver.displayName}`)
    console.log(`  Driver Normalized: ${link.driver.normalizedName || "(not set)"}`)
    console.log(`  EventDriverLink Match: ${link.matchType} (${link.similarityScore.toFixed(3)})`)
    console.log(`  UserDriverLink Status: ${link.userDriverLink?.status || "null"}`)
    console.log(`  Current Verification: ${matchInfo}`)
    console.log(`  Would Include: ${isHighConfidenceMatch ? "YES" : "NO"}`)
    console.log()
    
    if (isHighConfidenceMatch) {
      verifiedMatches.push(link.eventId)
    } else {
      rejectedMatches.push(link.eventId)
    }
  }
  
  console.log(`\n=== Summary ===`)
  console.log(`Verified matches (would be included): ${verifiedMatches.length}`)
  console.log(`Rejected matches (would be excluded): ${rejectedMatches.length}`)
  
  if (rejectedMatches.length > 0) {
    console.log(`\nRejected event IDs:`)
    rejectedMatches.forEach(id => console.log(`  - ${id}`))
  }
  
  // Check a specific track if provided
  const trackName = process.argv[3]
  if (trackName) {
    console.log(`\n=== Checking track: ${trackName} ===`)
    const track = await prisma.track.findFirst({
      where: {
        trackName: {
          contains: trackName,
          mode: "insensitive",
        },
      },
    })
    
    if (track) {
      console.log(`Track found: ${track.trackName} (ID: ${track.id})`)
      
      // Get events for this track that have EventDriverLinks for this user
      const trackEvents = await prisma.event.findMany({
        where: {
          trackId: track.id,
          id: {
            in: [...verifiedMatches, ...rejectedMatches],
          },
        },
        select: {
          id: true,
          eventName: true,
          eventDate: true,
        },
      })
      
      console.log(`\nEvents on this track:`)
      trackEvents.forEach(event => {
        const isVerified = verifiedMatches.includes(event.id)
        const status = isVerified ? "✓" : "✗"
        console.log(`  ${status} ${event.eventName} (${event.eventDate?.toISOString().split('T')[0]})`)
      })
    }
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

