#!/bin/sh
# Test script to verify Prisma client has auditLog model
# This can be run inside the Docker container to verify the fix

echo "Testing Prisma client..."
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

console.log('Checking Prisma client...');
console.log('auditLog exists:', typeof prisma.auditLog !== 'undefined');
console.log('auditLog type:', typeof prisma.auditLog);
console.log('auditLog.create exists:', typeof prisma.auditLog?.create !== 'undefined');
console.log('auditLog.create type:', typeof prisma.auditLog?.create);

if (typeof prisma.auditLog === 'undefined') {
  console.error('❌ ERROR: prisma.auditLog is undefined!');
  process.exit(1);
}

if (typeof prisma.auditLog.create !== 'function') {
  console.error('❌ ERROR: prisma.auditLog.create is not a function!');
  process.exit(1);
}

console.log('✅ Prisma client has auditLog model');
process.exit(0);
"

