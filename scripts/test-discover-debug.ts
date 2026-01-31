/**
 * Test script to debug practice day discovery
 * Run with: docker exec mre-app npx tsx /app/scripts/test-discover-debug.ts
 */

const INGESTION_SERVICE_URL =
  process.env.INGESTION_SERVICE_URL || "http://mre-liverc-ingestion-service:8000"

async function testDiscover() {
  const trackSlug = "canberraoffroad"
  const year = 2025
  const month = 10

  console.log("=".repeat(80))
  console.log("Testing Practice Day Discovery")
  console.log("=".repeat(80))
  console.log(`Track Slug: ${trackSlug}`)
  console.log(`Year: ${year}`)
  console.log(`Month: ${month}`)
  console.log()

  try {
    const response = await fetch(`${INGESTION_SERVICE_URL}/api/v1/practice-days/discover`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        track_slug: trackSlug,
        year: year,
        month: month,
      }),
    })

    console.log(`Status: ${response.status} ${response.statusText}`)
    console.log(`Headers:`, Object.fromEntries(response.headers.entries()))

    const text = await response.text()
    console.log(`Response Body:`, text)

    if (!response.ok) {
      try {
        const json = JSON.parse(text)
        console.log(`Parsed Error:`, JSON.stringify(json, null, 2))
      } catch (e) {
        console.log(`Could not parse as JSON`)
      }
    } else {
      try {
        const json = JSON.parse(text)
        console.log(`Success Response:`, JSON.stringify(json, null, 2))
      } catch (e) {
        console.log(`Could not parse as JSON`)
      }
    }
  } catch (error) {
    console.error("Error:", error)
  }
}

testDiscover()
