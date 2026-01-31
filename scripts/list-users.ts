import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

function formatTableRow(columns: string[], widths: number[]): string {
  return columns.map((col, i) => col.padEnd(widths[i])).join(" | ")
}

async function main() {
  const users = await prisma.user.findMany({
    orderBy: {
      createdAt: "asc",
    },
  })

  if (users.length === 0) {
    console.log("No users found in the database.")
    return
  }

  // Calculate column widths
  const emailWidth = Math.max("Email".length, ...users.map((u) => u.email.length))
  const driverNameWidth = Math.max("Driver Name".length, ...users.map((u) => u.driverName.length))
  const teamNameWidth = Math.max(
    "Team Name".length,
    ...users.map((u) => (u.teamName || "N/A").length)
  )
  const adminWidth = Math.max("Admin".length, 5)
  const createdAtWidth = Math.max("Created".length, 19)

  const widths = [emailWidth, driverNameWidth, teamNameWidth, adminWidth, createdAtWidth]

  // Header
  console.log(formatTableRow(["Email", "Driver Name", "Team Name", "Admin", "Created"], widths))
  console.log(
    formatTableRow(
      [
        "-".repeat(emailWidth),
        "-".repeat(driverNameWidth),
        "-".repeat(teamNameWidth),
        "-".repeat(adminWidth),
        "-".repeat(createdAtWidth),
      ],
      widths
    )
  )

  // Rows
  users.forEach((user) => {
    const teamName = user.teamName || "N/A"
    const isAdmin = user.isAdmin ? "Yes" : "No"
    const created = user.createdAt.toISOString().split("T")[0]

    console.log(formatTableRow([user.email, user.driverName, teamName, isAdmin, created], widths))
  })

  console.log(`\nTotal: ${users.length} user(s)`)
}

main()
  .catch((e) => {
    console.error("Error querying database:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
