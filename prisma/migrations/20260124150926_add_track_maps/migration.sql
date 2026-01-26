-- CreateTable
CREATE TABLE "track_maps" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "track_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "map_data" JSONB NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "share_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "track_maps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "track_maps_user_id_track_id_idx" ON "track_maps"("user_id", "track_id");

-- CreateIndex
CREATE INDEX "track_maps_is_public_idx" ON "track_maps"("is_public");

-- CreateIndex
CREATE UNIQUE INDEX "track_maps_share_token_key" ON "track_maps"("share_token");

-- AddForeignKey
ALTER TABLE "track_maps" ADD CONSTRAINT "track_maps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_maps" ADD CONSTRAINT "track_maps_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
