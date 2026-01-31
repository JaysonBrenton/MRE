/**
 * Diagnostic script to check authentication issues
 * Run with: npx ts-node --compiler-options '{"module":"commonjs"}' scripts/diagnose-auth.ts
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function diagnose() {
  console.log("=== Authentication Diagnostic ===\n")

  const emails = [
    "jaysoncareybrenton@gmail.com",
    "jaysonbrenton@hotmail.com",
    "JAYSONBRENTON@HOTMAIL.COM",
    "JaysonBrenton@Hotmail.com",
  ]

  for (const email of emails) {
    console.log(`Checking email: "${email}"`)
    console.log(`  Length: ${email.length}`)
    console.log(`  Lowercase: "${email.toLowerCase()}"`)

    // Try exact match
    const exactUser = await prisma.user.findUnique({
      where: { email },
    })
    console.log(`  Exact match: ${exactUser ? "FOUND" : "NOT FOUND"}`)

    // Try lowercase match
    const lowerUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })
    console.log(`  Lowercase match: ${lowerUser ? "FOUND" : "NOT FOUND"}`)

    // Try case-insensitive search
    const caseInsensitiveUser = await prisma.$queryRaw<Array<{ email: string }>>`
      SELECT email FROM users WHERE LOWER(email) = LOWER(${email})
    `
    console.log(
      `  Case-insensitive match: ${caseInsensitiveUser.length > 0 ? "FOUND" : "NOT FOUND"}`
    )
    if (caseInsensitiveUser.length > 0) {
      console.log(`    Found email in DB: "${caseInsensitiveUser[0].email}"`)
    }

    console.log("")
  }

  // List all users
  console.log("\n=== All Users in Database ===")
  const allUsers = await prisma.user.findMany({
    select: {
      email: true,
      driverName: true,
      isAdmin: true,
    },
  })

  for (const user of allUsers) {
    console.log(`Email: "${user.email}" | Driver: ${user.driverName} | Admin: ${user.isAdmin}`)
    console.log(`  Length: ${user.email.length} | Lowercase: "${user.email.toLowerCase()}"`)
  }

  await prisma.$disconnect()
}

diagnose().catch(console.error)
