/**
 * Update admin user credentials
 * 
 * This script updates the admin user's email and password.
 * If the admin user doesn't exist, it will be created.
 */

import { PrismaClient } from "@prisma/client"
import argon2 from "argon2"

const prisma = new PrismaClient()

async function main() {
  const adminEmail = process.argv[2] || "admin@mre.local"
  const adminPassword = process.argv[3] || "Wilier2013"
  const adminDriverName = process.env.ADMIN_DRIVER_NAME || "Administrator"

  console.log("=== Update Admin Credentials ===\n")
  console.log(`Email: ${adminEmail}`)
  console.log(`Password: ${adminPassword}`)
  console.log(`Driver Name: ${adminDriverName}\n`)

  // Normalize email to lowercase for consistent storage
  const normalizedEmail = adminEmail.toLowerCase().trim()

  // Hash password using Argon2id
  const passwordHash = await argon2.hash(adminPassword)

  // Check if admin already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  })

  if (existingAdmin) {
    // Update existing admin
    console.log(`Updating existing admin user with email ${normalizedEmail}...`)
    
    const updatedAdmin = await prisma.user.update({
      where: { email: normalizedEmail },
      data: {
        passwordHash,
        driverName: adminDriverName,
        isAdmin: true,
      }
    })

    // Ensure admin persona is assigned
    try {
      const adminPersona = await prisma.persona.findUnique({
        where: { type: "admin" }
      })
      if (adminPersona) {
        await prisma.user.update({
          where: { id: updatedAdmin.id },
          data: { personaId: adminPersona.id }
        })
        console.log(`Admin persona assigned to user`)
      }
    } catch (error) {
      console.error(`Failed to assign Admin persona:`, error)
      // Continue even if persona assignment fails
    }

    console.log(`\n✅ Admin user updated successfully:`)
    console.log(`  Email: ${updatedAdmin.email}`)
    console.log(`  Driver Name: ${updatedAdmin.driverName}`)
    console.log(`  Password: ${adminPassword}`)
  } else {
    // Create new admin
    console.log(`Creating new admin user...`)
    
    const admin = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        driverName: adminDriverName,
        teamName: null,
        isAdmin: true,
      }
    })

    // Auto-assign Admin persona
    try {
      const adminPersona = await prisma.persona.findUnique({
        where: { type: "admin" }
      })
      if (adminPersona) {
        await prisma.user.update({
          where: { id: admin.id },
          data: { personaId: adminPersona.id }
        })
        console.log(`Admin persona assigned to user`)
      }
    } catch (error) {
      console.error(`Failed to assign Admin persona:`, error)
      // Continue even if persona assignment fails
    }

    console.log(`\n✅ Admin user created successfully:`)
    console.log(`  Email: ${admin.email}`)
    console.log(`  Driver Name: ${admin.driverName}`)
    console.log(`  Password: ${adminPassword}`)
  }
}

main()
  .catch((e) => {
    console.error("Error updating admin credentials:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

