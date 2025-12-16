import { PrismaClient } from "@prisma/client"
import argon2 from "argon2"

const prisma = new PrismaClient()

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@mre.local"
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123456"
  const adminDriverName = process.env.ADMIN_DRIVER_NAME || "Administrator"

  // Normalize email to lowercase for consistent storage
  const normalizedEmail = adminEmail.toLowerCase().trim()

  // Check if admin already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  })

  if (existingAdmin) {
    console.log(`Admin user with email ${normalizedEmail} already exists. Skipping creation.`)
    return
  }

  // Hash password using Argon2id (required by mobile-safe architecture guidelines)
  const passwordHash = await argon2.hash(adminPassword)

  // Create admin user (email is already normalized)
  const admin = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      driverName: adminDriverName,
      teamName: null,
      isAdmin: true,
    }
  })

  console.log(`Admin user created successfully:`)
  console.log(`  Email: ${admin.email}`)
  console.log(`  Driver Name: ${admin.driverName}`)
  console.log(`  Password: ${adminPassword} (change this after first login!)`)
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

