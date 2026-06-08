-- CreateTable
CREATE TABLE "ingestion_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "ingestion_settings_pkey" PRIMARY KEY ("key")
);

-- AddForeignKey
ALTER TABLE "ingestion_settings" ADD CONSTRAINT "ingestion_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
