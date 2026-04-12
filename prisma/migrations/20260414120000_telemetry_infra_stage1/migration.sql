-- Telemetry infrastructure (stage 1): metadata tables, Postgres job queue.
-- See docs/implimentation_plans/telemetry-implementation-plan.md and docs/telemetry/

CREATE TYPE "TelemetrySessionPrivacy" AS ENUM ('PRIVATE', 'TEAM', 'PUBLIC');
CREATE TYPE "TelemetrySessionStatus" AS ENUM ('UPLOADING', 'PROCESSING', 'READY', 'FAILED', 'DELETED');
CREATE TYPE "TelemetryArtifactRole" AS ENUM ('GNSS', 'IMU', 'FUSED', 'MIXED', 'UNKNOWN');
CREATE TYPE "TelemetryArtifactStatus" AS ENUM ('UPLOADED', 'CANONICALISED', 'REJECTED', 'DELETED');
CREATE TYPE "TelemetryDeviceType" AS ENUM ('PHONE', 'RACEBOX', 'CUSTOM', 'OTHER');
CREATE TYPE "TelemetryProcessingRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');
CREATE TYPE "TelemetryJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');
CREATE TYPE "TelemetryDatasetType" AS ENUM (
  'CANON_GNSS',
  'CANON_ACCEL',
  'CANON_GYRO',
  'CANON_MAG',
  'FUSED_POSE',
  'LAP_EVENTS',
  'DOWNSAMPLE_GNSS',
  'DOWNSAMPLE_ACCEL',
  'DOWNSAMPLE_GYRO',
  'DOWNSAMPLE_MAG',
  'DOWNSAMPLE_POSE'
);
CREATE TYPE "TelemetryDatasetSensorType" AS ENUM ('GNSS', 'IMU', 'FUSION');
CREATE TYPE "TelemetryLapValidity" AS ENUM ('VALID', 'INVALID', 'OUTLAP', 'INLAP');

CREATE TABLE "telemetry_devices" (
    "id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "device_type" "TelemetryDeviceType" NOT NULL,
    "make" TEXT,
    "model" TEXT,
    "serial" TEXT,
    "firmware_version" TEXT,
    "capabilities" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telemetry_devices_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "telemetry_devices_owner_user_id_idx" ON "telemetry_devices"("owner_user_id");
CREATE INDEX "telemetry_devices_device_type_idx" ON "telemetry_devices"("device_type");

ALTER TABLE "telemetry_devices" ADD CONSTRAINT "telemetry_devices_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Sessions first without current_run_id (FK to processing_runs added after runs exist)
CREATE TABLE "telemetry_sessions" (
    "id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "driver_profile_id" TEXT,
    "track_id" TEXT,
    "name" TEXT,
    "notes" TEXT,
    "privacy" "TelemetrySessionPrivacy" NOT NULL DEFAULT 'PRIVATE',
    "start_time_utc" TIMESTAMP(3) NOT NULL,
    "end_time_utc" TIMESTAMP(3) NOT NULL,
    "time_zone" TEXT,
    "primary_device_id" TEXT,
    "status" "TelemetrySessionStatus" NOT NULL DEFAULT 'UPLOADING',
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telemetry_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "telemetry_sessions_owner_user_id_start_time_utc_idx" ON "telemetry_sessions"("owner_user_id", "start_time_utc" DESC);
CREATE INDEX "telemetry_sessions_track_id_start_time_utc_idx" ON "telemetry_sessions"("track_id", "start_time_utc" DESC);

ALTER TABLE "telemetry_sessions" ADD CONSTRAINT "telemetry_sessions_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "telemetry_sessions" ADD CONSTRAINT "telemetry_sessions_driver_profile_id_fkey" FOREIGN KEY ("driver_profile_id") REFERENCES "driver_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "telemetry_sessions" ADD CONSTRAINT "telemetry_sessions_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "telemetry_sessions" ADD CONSTRAINT "telemetry_sessions_primary_device_id_fkey" FOREIGN KEY ("primary_device_id") REFERENCES "telemetry_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "telemetry_processing_runs" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "status" "TelemetryProcessingRunStatus" NOT NULL,
    "requested_by_user_id" TEXT,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "pipeline_version" TEXT NOT NULL,
    "canonicaliser_version" TEXT NOT NULL,
    "fusion_version" TEXT,
    "lap_detector_version" TEXT,
    "input_artifact_ids" JSONB NOT NULL,
    "output_dataset_ids" JSONB,
    "quality_summary" JSONB,
    "error_code" TEXT,
    "error_detail" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telemetry_processing_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "telemetry_processing_runs_session_id_started_at_idx" ON "telemetry_processing_runs"("session_id", "started_at" DESC);

ALTER TABLE "telemetry_processing_runs" ADD CONSTRAINT "telemetry_processing_runs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "telemetry_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "telemetry_processing_runs" ADD CONSTRAINT "telemetry_processing_runs_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Circular link: session.current_run_id -> run
ALTER TABLE "telemetry_sessions" ADD COLUMN "current_run_id" TEXT;
CREATE UNIQUE INDEX "telemetry_sessions_current_run_id_key" ON "telemetry_sessions"("current_run_id");
ALTER TABLE "telemetry_sessions" ADD CONSTRAINT "telemetry_sessions_current_run_id_fkey" FOREIGN KEY ("current_run_id") REFERENCES "telemetry_processing_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "telemetry_sessions_current_run_id_idx" ON "telemetry_sessions"("current_run_id");

CREATE TABLE "telemetry_artifacts" (
    "id" TEXT NOT NULL,
    "session_id" TEXT,
    "owner_user_id" TEXT NOT NULL,
    "device_id" TEXT,
    "artifact_role" "TelemetryArtifactRole" NOT NULL DEFAULT 'UNKNOWN',
    "original_file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "byte_size" BIGINT NOT NULL,
    "sha256" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "storage_path" TEXT NOT NULL,
    "format_detected" TEXT,
    "status" "TelemetryArtifactStatus" NOT NULL DEFAULT 'UPLOADED',
    "discarded_at" TIMESTAMP(3),
    "ingest_warnings" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telemetry_artifacts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "telemetry_artifacts_session_id_sha256_byte_size_key" ON "telemetry_artifacts"("session_id", "sha256", "byte_size");
CREATE INDEX "telemetry_artifacts_session_id_uploaded_at_idx" ON "telemetry_artifacts"("session_id", "uploaded_at");
CREATE INDEX "telemetry_artifacts_owner_user_id_uploaded_at_idx" ON "telemetry_artifacts"("owner_user_id", "uploaded_at");

ALTER TABLE "telemetry_artifacts" ADD CONSTRAINT "telemetry_artifacts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "telemetry_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "telemetry_artifacts" ADD CONSTRAINT "telemetry_artifacts_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "telemetry_artifacts" ADD CONSTRAINT "telemetry_artifacts_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "telemetry_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "telemetry_jobs" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "job_type" TEXT NOT NULL,
    "status" "TelemetryJobStatus" NOT NULL,
    "payload" JSONB,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "locked_at" TIMESTAMP(3),
    "locked_by" TEXT,
    "last_error_code" TEXT,
    "last_error_message" TEXT,
    "next_retry_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telemetry_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "telemetry_jobs_status_next_retry_at_created_at_idx" ON "telemetry_jobs"("status", "next_retry_at", "created_at");

ALTER TABLE "telemetry_jobs" ADD CONSTRAINT "telemetry_jobs_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "telemetry_processing_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "telemetry_datasets" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "dataset_type" "TelemetryDatasetType" NOT NULL,
    "sensor_type" "TelemetryDatasetSensorType",
    "imu_dof" INTEGER,
    "imu_channels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "frame" TEXT,
    "axis_convention" TEXT,
    "sample_rate_hz" INTEGER,
    "downsample_factor" INTEGER,
    "clickhouse_table" TEXT NOT NULL DEFAULT 'not_materialized',
    "clickhouse_where_hint" TEXT,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "units_version" INTEGER NOT NULL DEFAULT 1,
    "created_from_artifact_ids" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telemetry_datasets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "telemetry_datasets_session_id_dataset_type_idx" ON "telemetry_datasets"("session_id", "dataset_type");
CREATE INDEX "telemetry_datasets_run_id_idx" ON "telemetry_datasets"("run_id");

ALTER TABLE "telemetry_datasets" ADD CONSTRAINT "telemetry_datasets_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "telemetry_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "telemetry_datasets" ADD CONSTRAINT "telemetry_datasets_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "telemetry_processing_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "telemetry_laps" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "lap_number" INTEGER NOT NULL,
    "start_time_utc" TIMESTAMP(3) NOT NULL,
    "end_time_utc" TIMESTAMP(3) NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "validity" "TelemetryLapValidity" NOT NULL DEFAULT 'VALID',
    "quality_score" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telemetry_laps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "telemetry_laps_run_id_lap_number_key" ON "telemetry_laps"("run_id", "lap_number");
CREATE INDEX "telemetry_laps_session_id_lap_number_idx" ON "telemetry_laps"("session_id", "lap_number");
CREATE INDEX "telemetry_laps_run_id_lap_number_idx" ON "telemetry_laps"("run_id", "lap_number");

ALTER TABLE "telemetry_laps" ADD CONSTRAINT "telemetry_laps_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "telemetry_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "telemetry_laps" ADD CONSTRAINT "telemetry_laps_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "telemetry_processing_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
