import { prisma } from "@/lib/prisma"

/**
 * Stale Prisma singletons (e.g. after schema add without `prisma generate` + restart) omit new delegates;
 * calling `undefined.findMany` yields "Cannot read properties of undefined (reading 'findMany')".
 */
export function assertCarTaxonomyPrismaReady(): void {
  const p = prisma as unknown as Record<string, unknown>
  if (p.carTaxonomyNode == null || p.userCarTaxonomyRule == null) {
    throw new Error(
      "Car taxonomy models are missing from the Prisma client. In Docker: `docker exec -it mre-app npx prisma generate` then `docker compose restart app`. Also run `docker exec -it mre-app npx prisma migrate deploy` if migrations are not applied."
    )
  }
}
