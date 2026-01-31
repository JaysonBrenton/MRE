/**
 * Migration script to normalize all email addresses to lowercase
 * Run with: npx ts-node --compiler-options '{"module":"commonjs"}' scripts/normalize-emails.ts
 *
 * This script ensures all existing email addresses in the database are stored
 * in lowercase for consistent lookups. This is a one-time migration that can
 * be run to fix any existing mixed-case emails.
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function normalizeEmails() {
  console.log("=== Email Normalization Migration ===\n")

  // Get all users
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
    },
  })

  console.log(`Found ${users.length} users to check\n`)

  let normalizedCount = 0

  for (const user of users) {
    const normalizedEmail = user.email.toLowerCase().trim()

    // Only update if email needs normalization
    if (user.email !== normalizedEmail) {
      console.log(`Normalizing: "${user.email}" -> "${normalizedEmail}"`)

      try {
        // Check if normalized email already exists (would cause unique constraint violation)
        const existingUser = await prisma.user.findUnique({
          where: { email: normalizedEmail },
        })

        if (existingUser && existingUser.id !== user.id) {
          console.log(
            `  WARNING: Normalized email "${normalizedEmail}" already exists for another user. Skipping.`
          )
          continue
        }

        // Update email to normalized version
        await prisma.user.update({
          where: { id: user.id },
          data: { email: normalizedEmail },
        })

        normalizedCount++
        console.log(`  ✓ Updated`)
      } catch (error) {
        console.error(`  ✗ Error updating user ${user.id}:`, error)
      }
    } else {
      console.log(`✓ "${user.email}" is already normalized`)
    }
  }

  console.log("\n=== Migration Complete ===")
  console.log(`Normalized ${normalizedCount} email address(es)`)

  await prisma.$disconnect()
}

normalizeEmails().catch(console.error)
