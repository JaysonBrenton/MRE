// Quick script to check if audit_logs table exists
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

async function checkTable() {
  try {
    // Try to query the table
    const result = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'audit_logs'
    `
    console.log("Table exists:", result.length > 0)
    if (result.length > 0) {
      console.log("Table found:", result[0])
    } else {
      console.log("Table audit_logs does NOT exist")
    }
  } catch (error) {
    console.error("Error checking table:", error.message)
  } finally {
    await prisma.$disconnect()
  }
}

checkTable()
