/**
 * @fileoverview Test LiveRC matching with actual user data
 * 
 * Tests the LiveRC driver matching with the actual user "Jayson Brenton"
 */

import { PrismaClient } from "@prisma/client"
import { normalizeDriverName } from "../src/core/users/name-normalizer"
import { fuzzyMatchUserToDriver, SUGGEST_MIN } from "../src/core/users/driver-matcher"

const prisma = new PrismaClient()

async function main() {
  console.log("Testing LiveRC matching with actual user data\n")
  console.log("=" .repeat(80))

  // Find user with driver name "Jayson Brenton"
  const user = await prisma.user.findFirst({
    where: {
      driverName: {
        contains: "Jayson",
        mode: "insensitive",
      },
    },
  })

  if (!user) {
    console.error("No user found with driver name containing 'Jayson'")
    console.log("\nAvailable users:")
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        driverName: true,
        normalizedName: true,
      },
    })
    allUsers.forEach((u) => {
      console.log(`  - ${u.driverName} (${u.email})`)
    })
    process.exit(1)
  }

  console.log(`Found user: ${user.driverName} (${user.email})`)
  console.log(`User ID: ${user.id}`)
  console.log(`Normalized name: ${user.normalizedName || normalizeDriverName(user.driverName)}`)
  console.log(`Transponder: ${user.transponderNumber || "none"}`)
  console.log()

  // Test with some sample driver names that might appear in LiveRC
  const testDrivers = [
    "Jayson Brenton",
    "jayson brenton",
    "JAYSON BRENTON",
    "Jay Brenton",
    "Jason Brenton",
    "Jayson B.",
    "Jayson Brenton Jr.",
    "J. Brenton",
  ]

  console.log("Testing matching with sample driver names:\n")

  for (const driverName of testDrivers) {
    const driverNormalized = normalizeDriverName(driverName)
    const userNormalized = user.normalizedName || normalizeDriverName(user.driverName)

    const match = fuzzyMatchUserToDriver(
      {
        id: user.id,
        driverName: user.driverName,
        normalizedName: userNormalized,
        transponderNumber: user.transponderNumber,
      },
      {
        id: "test-driver-id",
        displayName: driverName,
        normalizedName: driverNormalized,
        transponderNumber: null,
      },
      true // Skip transponder matching (LiveRC mode)
    )

    const matched = match !== null && (
      match.matchType === "exact" ||
      (match.matchType === "fuzzy" && match.similarityScore >= SUGGEST_MIN)
    )

    const status = matched ? "✓ MATCH" : "✗ NO MATCH"
    console.log(`${status}: "${driverName}"`)
    if (match) {
      console.log(`  Type: ${match.matchType}, Similarity: ${match.similarityScore.toFixed(3)}`)
      console.log(`  User normalized: "${userNormalized}"`)
      console.log(`  Driver normalized: "${driverNormalized}"`)
      if (match.matchType === "fuzzy" && match.similarityScore < SUGGEST_MIN) {
        console.log(`  ⚠ Below threshold (${match.similarityScore.toFixed(3)} < ${SUGGEST_MIN})`)
      }
    } else {
      console.log(`  User normalized: "${userNormalized}"`)
      console.log(`  Driver normalized: "${driverNormalized}"`)
    }
    console.log()
  }

  // Check for events linked to this user
  console.log("Checking for events linked to this user:\n")
  const eventLinks = await prisma.eventDriverLink.findMany({
    where: {
      userId: user.id,
    },
    include: {
      event: {
        select: {
          id: true,
          eventName: true,
          eventDate: true,
          sourceEventId: true,
        },
      },
      driver: {
        select: {
          displayName: true,
          normalizedName: true,
        },
      },
    },
    take: 10,
  })

  if (eventLinks.length > 0) {
    console.log(`Found ${eventLinks.length} EventDriverLink records:`)
    eventLinks.forEach((link) => {
      console.log(`  - Event: "${link.event.eventName}" (${link.event.sourceEventId})`)
      console.log(`    Driver: "${link.driver.displayName}"`)
      console.log(`    Match type: ${link.matchType}, Similarity: ${link.similarityScore.toFixed(3)}`)
    })
  } else {
    console.log("No EventDriverLink records found for this user")
  }

  console.log()
  console.log("=" .repeat(80))
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error("Error:", error)
  process.exit(1)
})

