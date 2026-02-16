/**
 * Query DB for Canberra practice day Aug 24, 2025
 * Run: docker exec mre-app node scripts/query-practice-aug24.mjs
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const start = new Date("2025-08-24T00:00:00.000Z");
  const end = new Date("2025-08-25T00:00:00.000Z");

  const event = await prisma.event.findFirst({
    where: {
      eventDate: { gte: start, lt: end },
      sourceEventId: { contains: "canberraoffroad-practice", mode: "insensitive" },
    },
    include: {
      track: { select: { trackName: true, sourceTrackSlug: true } },
      races: {
        orderBy: { startTime: "asc" },
        include: {
          _count: { select: { drivers: true, results: true } },
          results: {
            include: {
              _count: { select: { laps: true } },
              raceDriver: { select: { displayName: true } },
            },
          },
        },
      },
      raceClasses: true,
    },
  });

  if (!event) {
    console.log("No practice day event found for 2025-08-24 Canberra.");
    return;
  }

  const lapCount = await prisma.lap.count({
    where: { raceResult: { race: { eventId: event.id } } },
  });

  const expected = { sessions: 4, totalLaps: 48, drivers: 4, classes: 3 };
  const actual = {
    sessions: event.races.length,
    totalLaps: lapCount,
    classes: event.raceClasses.length,
  };

  console.log("=== EVENT ===\n");
  console.log(JSON.stringify({
    id: event.id,
    sourceEventId: event.sourceEventId,
    eventName: event.eventName,
    eventDate: event.eventDate.toISOString(),
    eventDrivers: event.eventDrivers,
    metadata: event.metadata,
  }, null, 2));

  console.log("\n=== EXPECTED vs ACTUAL ===\n");
  console.log("Sessions (races):", expected.sessions, "->", actual.sessions, actual.sessions === expected.sessions ? "OK" : "MISMATCH");
  console.log("Total laps:      ", expected.totalLaps, "->", actual.totalLaps, actual.totalLaps === expected.totalLaps ? "OK" : "MISMATCH");
  console.log("Classes:         ", expected.classes, "->", actual.classes, actual.classes === expected.classes ? "OK" : "MISMATCH");

  console.log("\n=== RACES (Sessions) ===\n");
  for (let i = 0; i < event.races.length; i++) {
    const r = event.races[i];
    const res = r.results[0];
    const laps = res ? res._count.laps : 0;
    console.log(`${i + 1}. ${r.raceLabel} | ${r.className} | start: ${r.startTime?.toISOString() ?? "n/a"} | drivers: ${r._count.drivers} | laps: ${laps}`);
  }

  console.log("\n=== SAMPLE RACE METADATA (first race) ===\n");
  const firstRace = event.races[0];
  if (firstRace) {
    const raceWithMeta = await prisma.race.findUnique({
      where: { id: firstRace.id },
      select: { raceMetadata: true, raceLabel: true },
    });
    console.log(JSON.stringify(raceWithMeta, null, 2));
  }

  console.log("\n=== LAP SAMPLE (first 5 laps of first result) ===\n");
  const firstResult = event.races[0]?.results[0];
  if (firstResult?.id) {
    const laps = await prisma.lap.findMany({
      where: { raceResultId: firstResult.id },
      orderBy: { lapNumber: "asc" },
      take: 5,
      select: { lapNumber: true, lapTimeRaw: true, lapTimeSeconds: true },
    });
    console.log(JSON.stringify(laps, null, 2));
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
