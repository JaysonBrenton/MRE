/**
 * Script to clear all weather data from the database
 * 
 * This script deletes all records from the weather_data table.
 * 
 * WARNING: This will permanently delete all cached weather data.
 * Weather data will be re-fetched on-demand when requested for events.
 * 
 * Usage: npx tsx scripts/clear-weather-data.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Checking weather_data table...')
  
  // First, count existing records
  const count = await prisma.weatherData.count()
  console.log(`Found ${count} weather data record(s)`)
  
  if (count === 0) {
    console.log('No weather data to clear. Exiting.')
    await prisma.$disconnect()
    return
  }
  
  // Confirm deletion
  console.log(`\n⚠️  WARNING: This will delete ALL ${count} weather data record(s)`)
  console.log('Weather data will be re-fetched on-demand when requested for events.\n')
  
  // Delete all records
  const result = await prisma.weatherData.deleteMany({})
  
  console.log(`✅ Successfully deleted ${result.count} weather data record(s)`)
  console.log('\nNote: Weather data will be automatically re-fetched when:')
  console.log('  - Someone requests weather for an event via the API')
  console.log('  - Historical weather will be fetched from Open-Meteo Archive API for past events')
  console.log('  - Current/forecast weather will be fetched for future events')
}

main()
  .catch((error) => {
    console.error('Error clearing weather data:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

