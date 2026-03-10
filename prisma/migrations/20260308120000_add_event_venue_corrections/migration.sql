-- CreateEnum
CREATE TYPE "EventVenueCorrectionRequestStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "event_venue_corrections" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "venue_track_id" TEXT,
    "submitted_by_user_id" TEXT NOT NULL,
    "approved_at" TIMESTAMP(3) NOT NULL,
    "approved_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_venue_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_venue_correction_requests" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "venue_track_id" TEXT,
    "submitted_by_user_id" TEXT NOT NULL,
    "status" "EventVenueCorrectionRequestStatus" NOT NULL DEFAULT 'pending',
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_user_id" TEXT,
    "admin_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_venue_correction_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_venue_corrections_event_id_key" ON "event_venue_corrections"("event_id");

-- CreateIndex
CREATE INDEX "event_venue_corrections_event_id_idx" ON "event_venue_corrections"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_venue_correction_requests_event_id_key" ON "event_venue_correction_requests"("event_id");

-- CreateIndex
CREATE INDEX "event_venue_correction_requests_status_idx" ON "event_venue_correction_requests"("status");

-- CreateIndex
CREATE INDEX "event_venue_correction_requests_event_id_idx" ON "event_venue_correction_requests"("event_id");

-- AddForeignKey
ALTER TABLE "event_venue_corrections" ADD CONSTRAINT "event_venue_corrections_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_venue_corrections" ADD CONSTRAINT "event_venue_corrections_venue_track_id_fkey" FOREIGN KEY ("venue_track_id") REFERENCES "tracks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_venue_corrections" ADD CONSTRAINT "event_venue_corrections_submitted_by_user_id_fkey" FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_venue_corrections" ADD CONSTRAINT "event_venue_corrections_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_venue_correction_requests" ADD CONSTRAINT "event_venue_correction_requests_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_venue_correction_requests" ADD CONSTRAINT "event_venue_correction_requests_venue_track_id_fkey" FOREIGN KEY ("venue_track_id") REFERENCES "tracks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_venue_correction_requests" ADD CONSTRAINT "event_venue_correction_requests_submitted_by_user_id_fkey" FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_venue_correction_requests" ADD CONSTRAINT "event_venue_correction_requests_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
