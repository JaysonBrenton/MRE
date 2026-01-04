-- CreateTable
CREATE TABLE "application_logs" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "service" TEXT NOT NULL DEFAULT 'nextjs',
    "context" JSONB,
    "request_id" TEXT,
    "user_id" TEXT,
    "ip" TEXT,
    "path" TEXT,
    "method" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "application_logs_level_idx" ON "application_logs"("level");

-- CreateIndex
CREATE INDEX "application_logs_service_idx" ON "application_logs"("service");

-- CreateIndex
CREATE INDEX "application_logs_created_at_idx" ON "application_logs"("created_at");

-- CreateIndex
CREATE INDEX "application_logs_level_service_idx" ON "application_logs"("level", "service");

-- CreateIndex
CREATE INDEX "application_logs_service_created_at_idx" ON "application_logs"("service", "created_at");

-- CreateIndex
CREATE INDEX "application_logs_request_id_idx" ON "application_logs"("request_id");

-- CreateIndex
CREATE INDEX "application_logs_user_id_idx" ON "application_logs"("user_id");

