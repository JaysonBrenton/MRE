/**
 * Test Canberra practice flow: search with includePracticeDays, then discover Nov 2025.
 * Run: docker exec mre-app node scripts/test-canberra-practice-flow.mjs
 * Uses dynamic import of TS modules via the app's built code - we use fetch to the ingestion service instead.
 */

const CANBERRA_TRACK_ID = "2aba913f-eb28-4b11-9f67-e9fdbdf52172";

async function main() {
  console.log("1. Testing Python discover directly (canberraoffroad, 2025, 11)...");
  const ingestionUrl = process.env.INGESTION_SERVICE_URL || "http://liverc-ingestion-service:8000";
  const discoverRes = await fetch(`${ingestionUrl}/api/v1/practice-days/discover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      track_slug: "canberraoffroad",
      year: 2025,
      month: 11,
    }),
  });
  const discoverJson = await discoverRes.json();
  const practiceDays = discoverJson.data?.practice_days ?? discoverJson.data?.practiceDays;
  console.log("   Status:", discoverRes.status);
  console.log("   Response keys:", discoverJson.data ? Object.keys(discoverJson.data) : "no data");
  console.log("   practice_days count:", Array.isArray(discoverJson.data?.practice_days) ? discoverJson.data.practice_days.length : "n/a");
  console.log("   practiceDays count:", Array.isArray(discoverJson.data?.practiceDays) ? discoverJson.data.practiceDays.length : "n/a");
  console.log("   Resolved list count:", Array.isArray(practiceDays) ? practiceDays.length : 0);
  if (Array.isArray(practiceDays) && practiceDays.length > 0) {
    console.log("   First practice day:", practiceDays[0].date, "sessions:", practiceDays[0].session_count ?? practiceDays[0].session_count);
  }
  console.log("");
  if (!Array.isArray(practiceDays) || practiceDays.length === 0) {
    console.log("FAIL: No practice days returned. Check Python discover response shape.");
    process.exit(1);
  }
  console.log("PASS: Canberra Nov 2025 practice discover returns", practiceDays.length, "day(s).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
