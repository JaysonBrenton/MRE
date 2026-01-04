// Script to manually create the audit_logs table
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function createTable() {
  try {
    console.log('Creating audit_logs table...')
    
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id" TEXT NOT NULL,
        "user_id" TEXT,
        "action" TEXT NOT NULL,
        "resource_type" TEXT NOT NULL,
        "resource_id" TEXT,
        "details" JSONB,
        "ip_address" TEXT,
        "user_agent" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
      )
    `
    
    console.log('Creating indexes...')
    
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "audit_logs_user_id_idx" ON "audit_logs"("user_id")`
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs"("action")`
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "audit_logs_resource_type_idx" ON "audit_logs"("resource_type")`
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs"("created_at")`
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at")`
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "audit_logs_resource_type_resource_id_idx" ON "audit_logs"("resource_type", "resource_id")`
    
    console.log('Adding foreign key...')
    
    // Check if foreign key already exists before adding
    const fkExists = await prisma.$queryRaw`
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'audit_logs_user_id_fkey'
    `
    
    if (fkExists.length === 0) {
      await prisma.$executeRaw`
        ALTER TABLE "audit_logs" 
        ADD CONSTRAINT "audit_logs_user_id_fkey" 
        FOREIGN KEY ("user_id") REFERENCES "users"("id") 
        ON DELETE SET NULL ON UPDATE CASCADE
      `
    }
    
    console.log('✅ audit_logs table created successfully!')
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('✅ Table already exists')
    } else {
      console.error('Error creating table:', error.message)
      throw error
    }
  } finally {
    await prisma.$disconnect()
  }
}

createTable()

