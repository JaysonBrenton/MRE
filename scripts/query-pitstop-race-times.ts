/**
 * One-off script: pitstop race times for a given event, race, and driver.
 * Run: docker exec -it mre-app npx ts-node --compiler-options '{"module":"commonjs"}' scripts/query-pitstop-race-times.ts
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const EVENT_NAME = "Southern Indoor Championship 2026"
const RACE_NAME = "Int Nitro Truggy A-Main"
const DRIVER_NAME = "MAD MADDY LONG"

interface Row {
  lap_number: number
  incident_type: string | null
  race_time_seconds: number
  lap_time_raw: string
  lap_time_seconds: number
}

function formatRaceTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toFixed(3)}`
}

async function main() {
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT
      la.lap_number,
      la.incident_type,
      l.elapsed_race_time AS race_time_seconds,
      l.lap_time_raw,
      l.lap_time_seconds
    FROM lap_annotations la
    JOIN laps l ON l.race_result_id = la.race_result_id AND l.lap_number = la.lap_number
    JOIN race_results rr ON rr.id = la.race_result_id
    JOIN race_drivers rd ON rd.id = rr.race_driver_id
    JOIN drivers d ON d.id = rd.driver_id
    JOIN races r ON r.id = rr.race_id
    JOIN events e ON e.id = r.event_id
    WHERE e.event_name = ${EVENT_NAME}
      AND (r.class_name = ${RACE_NAME} OR r.race_label = ${RACE_NAME})
      AND (rd.display_name = ${DRIVER_NAME} OR d.display_name = ${DRIVER_NAME})
      AND la.incident_type IN ('suspected_fuel_stop', 'suspected_flame_out')
    ORDER BY la.lap_number
  `
  console.log(
    `Pitstops for "${DRIVER_NAME}" in "${RACE_NAME}" at "${EVENT_NAME}":\n`
  )
  if (rows.length === 0) {
    console.log("No pitstop annotations found for this driver/race.")
    return
  }
  for (const row of rows) {
    console.log(
      `  Lap ${row.lap_number}: race time ${formatRaceTime(row.race_time_seconds)} (${row.lap_time_raw}), type: ${row.incident_type ?? "—"}`
    )
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
