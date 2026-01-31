/**
 * Debug script to test login authentication
 * Run with: npx ts-node --compiler-options '{"module":"commonjs"}' scripts/test-login.ts <email> <password>
 */

import { PrismaClient } from "@prisma/client"
import { authenticateUser } from "../src/core/auth/login"
import { normalizeEmail } from "../src/core/common/email"
import { findUserByEmail } from "../src/core/users/repo"

const prisma = new PrismaClient()

async function testLogin() {
  const email = process.argv[2] || "jaysoncareybrenton@gmail.com"
  const password = process.argv[3] || "S-works29er2016"

  console.log("=== Login Debug Test ===\n")
  console.log(`Testing with email: ${email}`)
  console.log(`Password: ${password.substring(0, 3)}***\n`)

  // Step 1: Check normalized email
  const normalizedEmail = normalizeEmail(email)
  console.log(`1. Normalized email: "${normalizedEmail}"\n`)

  // Step 2: Try to find user
  console.log("2. Looking up user in database...")
  const user = await findUserByEmail(normalizedEmail)
  if (!user) {
    console.log("   ❌ User not found with normalized email")

    // Try to find any user with similar email
    console.log("\n   Checking for users with similar emails...")
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        driverName: true,
      },
      take: 10,
    })

    console.log(`   Found ${allUsers.length} users in database:`)
    allUsers.forEach((u) => {
      const normalized = normalizeEmail(u.email)
      const matches = normalized === normalizedEmail
      console.log(`   - "${u.email}" (normalized: "${normalized}") ${matches ? "✓ MATCHES" : ""}`)
    })

    await prisma.$disconnect()
    return
  }

  console.log(`   ✓ User found:`)
  console.log(`     ID: ${user.id}`)
  console.log(`     Email: ${user.email}`)
  console.log(`     Driver Name: ${user.driverName}`)
  console.log(`     Admin: ${user.isAdmin}\n`)

  // Step 3: Test authentication
  console.log("3. Testing authentication...")
  const result = await authenticateUser({
    email,
    password,
  })

  if (result.success) {
    console.log("   ✓ Authentication successful!")
    console.log(`     User ID: ${result.user.id}`)
    console.log(`     Email: ${result.user.email}`)
    console.log(`     Driver Name: ${result.user.driverName}`)
    console.log(`     Admin: ${result.user.isAdmin}`)
  } else {
    console.log("   ❌ Authentication failed")
    console.log(`     Error Code: ${result.error.code}`)
    console.log(`     Error Message: ${result.error.message}`)
  }

  await prisma.$disconnect()
}

testLogin().catch((error) => {
  console.error("Error:", error)
  process.exit(1)
})
