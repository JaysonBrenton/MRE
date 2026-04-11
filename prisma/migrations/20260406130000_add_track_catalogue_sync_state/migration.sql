-- CreateTable
CREATE TABLE "track_catalogue_sync_state" (
    "id" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "track_catalogue_sync_state_pkey" PRIMARY KEY ("id")
);
