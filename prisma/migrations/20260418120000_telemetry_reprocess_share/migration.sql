-- Telemetry: reprocess cooldown tracking + optional public share token
ALTER TABLE "telemetry_sessions" ADD COLUMN IF NOT EXISTS "last_reprocess_at" TIMESTAMP(3);
ALTER TABLE "telemetry_sessions" ADD COLUMN IF NOT EXISTS "share_token" TEXT;
ALTER TABLE "telemetry_sessions" ADD COLUMN IF NOT EXISTS "share_token_created_at" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "telemetry_sessions_share_token_key" ON "telemetry_sessions"("share_token");
