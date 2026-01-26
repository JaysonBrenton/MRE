/**
 * Debug script to test practice day discovery
 * Run: docker exec mre-app npx tsx /tmp/debug-practice-day.ts
 */

import { getTrackById } from "@/core/tracks/repo"

async function debug() {
  const trackId = "2aba913f-eb28-4b11-9f67-e9fdbdf52172"
  
  console.log("Fetching track...")
  const track = await getTrackById(trackId)
  
  if (!track) {
    console.error("Track not found!")
    return
  }
  
  console.log("Track found:")
  console.log("  ID:", track.id)
  console.log("  Name:", track.trackName)
  console.log("  Source Track Slug:", track.sourceTrackSlug)
  console.log("  Source Track Slug type:", typeof track.sourceTrackSlug)
  console.log("  Source Track Slug is null?", track.sourceTrackSlug === null)
  console.log("  Source Track Slug is undefined?", track.sourceTrackSlug === undefined)
  
  if (!track.sourceTrackSlug) {
    console.error("ERROR: Track does not have sourceTrackSlug!")
    return
  }
  
  console.log("\nTesting backend call...")
  const INGESTION_SERVICE_URL = process.env.INGESTION_SERVICE_URL || "http://liverc-ingestion-service:8000"
  
  const payload = {
    track_slug: track.sourceTrackSlug,
    year: 2025,
    month: 10,
  }
  
  console.log("Payload:", JSON.stringify(payload, null, 2))
  
  try {
    const response = await fetch(
      `${INGESTION_SERVICE_URL}/api/v1/practice-days/discover`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    )
    
    console.log("\nResponse:")
    console.log("  Status:", response.status, response.statusText)
    console.log("  OK:", response.ok)
    
    const text = await response.text()
    console.log("  Body:", text)
    
    if (!response.ok) {
      try {
        const error = JSON.parse(text)
        console.log("\nParsed Error:")
        console.log(JSON.stringify(error, null, 2))
        
        if (error.detail) {
          console.log("\nFastAPI Validation Error Details:")
          if (Array.isArray(error.detail)) {
            error.detail.forEach((d: unknown, i: number) => {
              console.log(`  Error ${i + 1}:`, JSON.stringify(d, null, 2))
            })
          } else {
            console.log("  Detail:", error.detail)
          }
        }
      } catch {
        console.log("Could not parse error as JSON")
      }
    } else {
      try {
        const data = JSON.parse(text)
        console.log("\nSuccess Response:")
        console.log(JSON.stringify(data, null, 2))
      } catch {
        console.log("Could not parse response as JSON")
      }
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Fetch error:", error.message)
      console.error("Stack:", error.stack)
    } else {
      console.error("Fetch error:", String(error))
    }
  }
}

debug().catch(console.error)
