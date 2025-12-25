import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const forceFlag = process.argv.includes('--force')

  console.log('=== MRE Database: Remove Non-Administrator Users ===\n')

  // Count what will be deleted
  const nonAdminUsers = await prisma.user.findMany({
    where: { isAdmin: false },
    orderBy: { createdAt: 'asc' },
  })

  // Count what will be kept
  const adminUsers = await prisma.user.findMany({
    where: { isAdmin: true },
    orderBy: { createdAt: 'asc' },
  })

  console.log('📊 Current Database State:')
  console.log(`\n  Will be DELETED (non-admin users):`)
  if (nonAdminUsers.length === 0) {
    console.log(`    No non-admin users found`)
  } else {
    nonAdminUsers.forEach((user) => {
      console.log(`    - ${user.email} (${user.driverName})`)
    })
  }

  console.log(`\n  Will be KEPT (admin users):`)
  if (adminUsers.length === 0) {
    console.log(`    ⚠️  No admin users found!`)
  } else {
    adminUsers.forEach((user) => {
      console.log(`    - ${user.email} (${user.driverName})`)
    })
  }

  if (nonAdminUsers.length === 0) {
    console.log('\n✅ No non-admin users to delete. Database is already clean.')
    return
  }

  if (adminUsers.length === 0) {
    console.log('\n❌ ERROR: No admin users found! Cannot proceed with deletion.')
    console.log('   At least one admin user must exist in the database.')
    process.exit(1)
  }

  if (!forceFlag) {
    console.log(`\n⚠️  This will permanently delete ${nonAdminUsers.length} non-admin user(s)!`)
    console.log('   To proceed, run with --force flag:')
    console.log('   ts-node scripts/remove-non-admin-users.ts --force')
    process.exit(0)
  }

  console.log(`\n🗑️  Deleting ${nonAdminUsers.length} non-admin user(s)...`)

  // Delete all non-admin users
  const deleteResult = await prisma.user.deleteMany({
    where: { isAdmin: false },
  })

  console.log(`   Deleted ${deleteResult.count} user(s)`)

  console.log(`\n✅ Cleanup complete!`)

  // Verify cleanup
  const remainingNonAdmin = await prisma.user.count({ where: { isAdmin: false } })
  const remainingAdmin = await prisma.user.count({ where: { isAdmin: true } })

  console.log('\n📊 Final Database State:')
  console.log(`    Admin users: ${remainingAdmin}`)
  console.log(`    Non-admin users: ${remainingNonAdmin}`)
}

main()
  .catch((e) => {
    console.error('❌ Error during cleanup:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

