-- AlterTable
ALTER TABLE "events" ADD COLUMN "imported_by_user_id" TEXT;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_imported_by_user_id_fkey" FOREIGN KEY ("imported_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "events_imported_by_user_id_idx" ON "events"("imported_by_user_id");
