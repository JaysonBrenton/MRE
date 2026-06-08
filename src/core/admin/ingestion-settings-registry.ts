/**
 * @fileoverview Canonical registry of ingestion-related settings for the admin console
 *
 * @description Normative list of keys, types, defaults, validation, scope, and apply mode.
 *              Must stay in sync with ingestion/common/settings_registry.py (parity test).
 *
 * @relatedFiles
 * - docs/architecture/liverc-ingestion/33-ingestion-settings-registry-and-runtime-config.md
 * - docs/architecture/admin-ingestion-settings-console.md
 */

export type IngestionSettingCategory =
  | "scraping_safety"
  | "ingestion_queue"
  | "track_sync"
  | "recent_events_auto_ingest"
  | "practice_days"
  | "telemetry"
  | "infrastructure"
  | "site_policy"
  | "code_constants"

export type IngestionSettingScope = "ingestion" | "app" | "both" | "telemetry"

export type IngestionSettingApplyMode = "runtime" | "restart" | "readonly"

export type IngestionSettingType =
  | "boolean"
  | "integer"
  | "number"
  | "string"
  | "enum"
  | "path"
  | "json"

export type IngestionSettingConfirmWhen = "disable_scrape" | "unlimited_ingests" | "disable_queue"

export type IngestionSettingDockerService =
  | "liverc-ingestion-service"
  | "telemetry-worker"
  | "app"
  | "all"

export interface IngestionSettingDefinitionInput {
  key: string
  label: string
  description: string
  category: IngestionSettingCategory
  type: IngestionSettingType
  default: string | number | boolean
  scope: IngestionSettingScope
  applyMode: IngestionSettingApplyMode
  min?: number
  max?: number
  enumValues?: readonly string[]
  confirmWhen?: IngestionSettingConfirmWhen
  dockerService?: IngestionSettingDockerService
  /** When true, effective value must be masked in admin API responses */
  secret?: boolean
}

export interface IngestionSettingDefinition extends IngestionSettingDefinitionInput {
  writable: boolean
}

export interface IngestionSettingCategoryGroup {
  category: IngestionSettingCategory
  label: string
  settings: IngestionSettingDefinition[]
}

/** Subset compared by TS ↔ Python registry parity tests. */
export interface RegistryParityRecord {
  key: string
  type: IngestionSettingType
  default: string | number | boolean
  applyMode: IngestionSettingApplyMode
  scope: IngestionSettingScope
  category: IngestionSettingCategory
}

export const INGESTION_SETTING_CATEGORY_LABELS: Record<IngestionSettingCategory, string> = {
  scraping_safety: "Scraping and safety",
  ingestion_queue: "Async ingestion queue",
  track_sync: "Track sync",
  recent_events_auto_ingest: "Recent events auto-ingest",
  practice_days: "Practice days",
  telemetry: "Telemetry worker",
  infrastructure: "Infrastructure",
  site_policy: "Site policy",
  code_constants: "Code constants",
}

export const INGESTION_SETTING_CATEGORY_ORDER: IngestionSettingCategory[] = [
  "scraping_safety",
  "ingestion_queue",
  "track_sync",
  "recent_events_auto_ingest",
  "practice_days",
  "telemetry",
  "infrastructure",
  "site_policy",
  "code_constants",
]

function defineSetting(input: IngestionSettingDefinitionInput): IngestionSettingDefinition {
  return {
    ...input,
    writable: input.applyMode === "runtime",
  }
}

const REGISTRY_ENTRIES: IngestionSettingDefinition[] = [
  // --- scraping_safety ---
  defineSetting({
    key: "MRE_SCRAPE_ENABLED",
    label: "LiveRC scraping enabled",
    description:
      "Global kill switch for all LiveRC HTTP requests (cron, CLI, downloads, admin sync).",
    category: "scraping_safety",
    type: "boolean",
    default: true,
    scope: "both",
    applyMode: "runtime",
    confirmWhen: "disable_scrape",
    dockerService: "all",
  }),
  defineSetting({
    key: "SITE_POLICY_PATH",
    label: "Site policy file path",
    description: "Path to shared site-policy JSON (throttling, robots, crawl delay).",
    category: "scraping_safety",
    type: "path",
    default: "/app/policies/site_policy/policy.json",
    scope: "ingestion",
    applyMode: "restart",
    dockerService: "liverc-ingestion-service",
  }),
  defineSetting({
    key: "SITE_POLICY_CACHE_MAX",
    label: "Site policy cache size",
    description: "Maximum entries in the conditional-request cache for site policy.",
    category: "scraping_safety",
    type: "integer",
    default: 256,
    scope: "ingestion",
    applyMode: "runtime",
    min: 0,
    max: 4096,
    dockerService: "liverc-ingestion-service",
  }),

  // --- ingestion_queue ---
  defineSetting({
    key: "INGESTION_USE_QUEUE",
    label: "Use ingestion queue",
    description:
      "When enabled, ingest requests return 202 and process in the background (forces one Uvicorn worker).",
    category: "ingestion_queue",
    type: "boolean",
    default: true,
    scope: "ingestion",
    applyMode: "restart",
    confirmWhen: "disable_queue",
    dockerService: "liverc-ingestion-service",
  }),
  defineSetting({
    key: "INGESTION_QUEUE_MAX_CONCURRENT",
    label: "Max concurrent ingestion jobs",
    description: "Maximum number of background ingestion jobs processed in parallel.",
    category: "ingestion_queue",
    type: "integer",
    default: 2,
    scope: "ingestion",
    applyMode: "runtime",
    min: 1,
    max: 16,
    dockerService: "liverc-ingestion-service",
  }),
  defineSetting({
    key: "INGESTION_QUEUE_JOB_TTL_SECONDS",
    label: "Job retention (seconds)",
    description: "How long completed or failed job metadata is kept in memory for status polling.",
    category: "ingestion_queue",
    type: "integer",
    default: 3600,
    scope: "ingestion",
    applyMode: "runtime",
    min: 60,
    max: 86400,
    dockerService: "liverc-ingestion-service",
  }),

  // --- track_sync ---
  defineSetting({
    key: "TRACK_SYNC_METADATA_CONCURRENCY",
    label: "Track metadata concurrency",
    description: "Parallel track dashboard metadata fetches during refresh-tracks.",
    category: "track_sync",
    type: "integer",
    default: 6,
    scope: "ingestion",
    applyMode: "runtime",
    min: 1,
    max: 32,
    dockerService: "liverc-ingestion-service",
  }),
  defineSetting({
    key: "TRACK_SYNC_REPORT_RETENTION_DAYS",
    label: "Track sync report retention (days)",
    description: "Number of days to retain track sync reports before automatic cleanup.",
    category: "track_sync",
    type: "integer",
    default: 30,
    scope: "ingestion",
    applyMode: "runtime",
    min: 1,
    max: 365,
    dockerService: "liverc-ingestion-service",
  }),

  // --- recent_events_auto_ingest ---
  defineSetting({
    key: "MRE_RECENT_EVENTS_AUTO_INGEST_ENABLED",
    label: "Recent events auto-ingest enabled",
    description:
      "Enables the nightly cron job that full-ingests recent events on configured tracks.",
    category: "recent_events_auto_ingest",
    type: "boolean",
    default: false,
    scope: "ingestion",
    applyMode: "runtime",
    dockerService: "liverc-ingestion-service",
  }),
  defineSetting({
    key: "MRE_RECENT_EVENTS_DAYS",
    label: "Recent events window (days)",
    description: "Recency window in calendar days for refresh-recent-events.",
    category: "recent_events_auto_ingest",
    type: "integer",
    default: 7,
    scope: "ingestion",
    applyMode: "runtime",
    min: 1,
    max: 90,
    dockerService: "liverc-ingestion-service",
  }),
  defineSetting({
    key: "MRE_RECENT_EVENTS_TRACKS",
    label: "Recent events track scope",
    description: "Which tracks are scanned: followed, active, or all.",
    category: "recent_events_auto_ingest",
    type: "enum",
    default: "followed",
    scope: "ingestion",
    applyMode: "runtime",
    enumValues: ["followed", "active", "all"],
    dockerService: "liverc-ingestion-service",
  }),
  defineSetting({
    key: "MRE_RECENT_EVENTS_MAX_INGESTS",
    label: "Max ingests per nightly run",
    description: "Cap on full (laps_full) ingests per cron run. Zero means unlimited.",
    category: "recent_events_auto_ingest",
    type: "integer",
    default: 50,
    scope: "ingestion",
    applyMode: "runtime",
    min: 0,
    max: 500,
    confirmWhen: "unlimited_ingests",
    dockerService: "liverc-ingestion-service",
  }),
  defineSetting({
    key: "MRE_RECENT_EVENTS_MIN_AGE_HOURS",
    label: "Minimum event age (hours)",
    description: "Skip events newer than this to avoid ingesting in-progress meetings.",
    category: "recent_events_auto_ingest",
    type: "integer",
    default: 12,
    scope: "ingestion",
    applyMode: "runtime",
    min: 0,
    max: 168,
    dockerService: "liverc-ingestion-service",
  }),

  // --- practice_days ---
  defineSetting({
    key: "PRACTICE_DAY_DETAIL_CONCURRENCY",
    label: "Practice day detail concurrency",
    description: "Parallel session-detail fetches during practice day ingestion.",
    category: "practice_days",
    type: "integer",
    default: 5,
    scope: "ingestion",
    applyMode: "runtime",
    min: 1,
    max: 20,
    dockerService: "liverc-ingestion-service",
  }),
  defineSetting({
    key: "PRACTICE_DISCOVER_CACHE_TTL_SECONDS",
    label: "Practice discover cache TTL (seconds)",
    description: "Cache TTL for practice day discovery results.",
    category: "practice_days",
    type: "integer",
    default: 600,
    scope: "ingestion",
    applyMode: "runtime",
    min: 0,
    max: 86400,
    dockerService: "liverc-ingestion-service",
  }),
  defineSetting({
    key: "PRACTICE_DISCOVER_MONTH_VIEW_TIMEOUT_SECONDS",
    label: "Practice month view timeout (seconds)",
    description: "HTTP timeout for practice month view scrape.",
    category: "practice_days",
    type: "number",
    default: 15,
    scope: "ingestion",
    applyMode: "runtime",
    min: 1,
    max: 120,
    dockerService: "liverc-ingestion-service",
  }),
  defineSetting({
    key: "PRACTICE_DISCOVER_DAY_OVERVIEW_TIMEOUT_SECONDS",
    label: "Practice day overview timeout (seconds)",
    description: "HTTP timeout for each practice day overview fetch.",
    category: "practice_days",
    type: "number",
    default: 25,
    scope: "ingestion",
    applyMode: "runtime",
    min: 1,
    max: 120,
    dockerService: "liverc-ingestion-service",
  }),

  // --- telemetry ---
  defineSetting({
    key: "TELEMETRY_UPLOAD_ROOT",
    label: "Telemetry upload root",
    description: "Root path for uploaded telemetry files (shared Docker volume).",
    category: "telemetry",
    type: "path",
    default: "/data/telemetry",
    scope: "telemetry",
    applyMode: "restart",
    dockerService: "telemetry-worker",
  }),
  defineSetting({
    key: "TELEMETRY_WORKER_ID",
    label: "Telemetry worker ID",
    description: "Identifier for the telemetry queue consumer process.",
    category: "telemetry",
    type: "string",
    default: "telemetry-worker-1",
    scope: "telemetry",
    applyMode: "restart",
    dockerService: "telemetry-worker",
  }),
  defineSetting({
    key: "TELEMETRY_WORKER_POLL_INTERVAL_SEC",
    label: "Telemetry worker poll interval (seconds)",
    description: "How often the telemetry worker polls the processing queue.",
    category: "telemetry",
    type: "number",
    default: 2,
    scope: "telemetry",
    applyMode: "runtime",
    dockerService: "telemetry-worker",
  }),
  defineSetting({
    key: "TELEMETRY_WORKER_CLICKHOUSE_HOST",
    label: "ClickHouse host (telemetry worker)",
    description: "ClickHouse host for GNSS materialisation. Empty skips ClickHouse writes.",
    category: "telemetry",
    type: "string",
    default: "",
    scope: "telemetry",
    applyMode: "restart",
    dockerService: "telemetry-worker",
  }),
  defineSetting({
    key: "CLICKHOUSE_HTTP_PORT",
    label: "ClickHouse HTTP port",
    description: "ClickHouse HTTP interface port.",
    category: "telemetry",
    type: "integer",
    default: 8123,
    scope: "telemetry",
    applyMode: "restart",
    dockerService: "telemetry-worker",
  }),
  defineSetting({
    key: "CLICKHOUSE_USER",
    label: "ClickHouse user",
    description: "ClickHouse username for telemetry materialisation.",
    category: "telemetry",
    type: "string",
    default: "default",
    scope: "telemetry",
    applyMode: "restart",
    dockerService: "telemetry-worker",
  }),
  defineSetting({
    key: "CLICKHOUSE_PASSWORD",
    label: "ClickHouse password",
    description: "ClickHouse password (masked in admin UI).",
    category: "telemetry",
    type: "string",
    default: "",
    scope: "telemetry",
    applyMode: "readonly",
    secret: true,
    dockerService: "telemetry-worker",
  }),

  // --- infrastructure ---
  defineSetting({
    key: "DATABASE_URL",
    label: "Database URL",
    description: "PostgreSQL connection string for the ingestion service.",
    category: "infrastructure",
    type: "string",
    default: "",
    scope: "ingestion",
    applyMode: "readonly",
    secret: true,
    dockerService: "liverc-ingestion-service",
  }),
  defineSetting({
    key: "DB_POOL_SIZE",
    label: "DB pool size",
    description: "SQLAlchemy connection pool size.",
    category: "infrastructure",
    type: "integer",
    default: 10,
    scope: "ingestion",
    applyMode: "restart",
    dockerService: "liverc-ingestion-service",
  }),
  defineSetting({
    key: "DB_MAX_OVERFLOW",
    label: "DB max overflow",
    description: "Extra connections beyond pool size.",
    category: "infrastructure",
    type: "integer",
    default: 20,
    scope: "ingestion",
    applyMode: "restart",
    dockerService: "liverc-ingestion-service",
  }),
  defineSetting({
    key: "LOG_LEVEL",
    label: "Log level",
    description: "Python structlog and Uvicorn log level.",
    category: "infrastructure",
    type: "enum",
    default: "INFO",
    scope: "ingestion",
    applyMode: "restart",
    enumValues: ["DEBUG", "INFO", "WARNING", "ERROR"],
    dockerService: "liverc-ingestion-service",
  }),
  defineSetting({
    key: "HOST",
    label: "Bind host",
    description: "API server bind address inside the container.",
    category: "infrastructure",
    type: "string",
    default: "0.0.0.0",
    scope: "ingestion",
    applyMode: "restart",
    dockerService: "liverc-ingestion-service",
  }),
  defineSetting({
    key: "PORT",
    label: "Bind port",
    description: "API server port inside the container.",
    category: "infrastructure",
    type: "integer",
    default: 8000,
    scope: "ingestion",
    applyMode: "restart",
    dockerService: "liverc-ingestion-service",
  }),
  defineSetting({
    key: "PYTHONUNBUFFERED",
    label: "Python unbuffered",
    description: "Python stdout/stderr unbuffered mode.",
    category: "infrastructure",
    type: "string",
    default: "1",
    scope: "ingestion",
    applyMode: "restart",
    dockerService: "liverc-ingestion-service",
  }),
  defineSetting({
    key: "TZ",
    label: "Timezone",
    description: "Container timezone for logs and cron.",
    category: "infrastructure",
    type: "string",
    default: "Australia/Sydney",
    scope: "ingestion",
    applyMode: "restart",
    dockerService: "liverc-ingestion-service",
  }),
  defineSetting({
    key: "UVICORN_RELOAD",
    label: "Uvicorn hot reload",
    description: "Enable development hot reload (single worker only).",
    category: "infrastructure",
    type: "boolean",
    default: false,
    scope: "ingestion",
    applyMode: "restart",
    dockerService: "liverc-ingestion-service",
  }),
  defineSetting({
    key: "UVICORN_WORKERS",
    label: "Uvicorn workers",
    description: "Worker count when reload is off. Forced to 1 when ingestion queue is enabled.",
    category: "infrastructure",
    type: "integer",
    default: 1,
    scope: "ingestion",
    applyMode: "restart",
    dockerService: "liverc-ingestion-service",
  }),
  defineSetting({
    key: "INGESTION_BUILD_TARGET",
    label: "Docker build target",
    description: "Docker image build stage (development vs production).",
    category: "infrastructure",
    type: "enum",
    default: "development",
    scope: "ingestion",
    applyMode: "readonly",
    enumValues: ["development", "production"],
    dockerService: "liverc-ingestion-service",
  }),
  defineSetting({
    key: "CORS_ALLOWED_ORIGINS",
    label: "CORS allowed origins",
    description: "Comma-separated list of allowed CORS origins for the ingestion API.",
    category: "infrastructure",
    type: "string",
    default: "http://localhost:3001",
    scope: "ingestion",
    applyMode: "restart",
    dockerService: "liverc-ingestion-service",
  }),
  defineSetting({
    key: "INGESTION_SERVICE_URL",
    label: "Ingestion service URL",
    description: "Base URL the Next.js app uses to call the Python ingestion service.",
    category: "infrastructure",
    type: "string",
    default: "http://liverc-ingestion-service:8000",
    scope: "app",
    applyMode: "readonly",
    dockerService: "app",
  }),
  defineSetting({
    key: "INGESTION_PORT",
    label: "Ingestion host port",
    description: "Host port mapped to the ingestion container API.",
    category: "infrastructure",
    type: "integer",
    default: 8000,
    scope: "app",
    applyMode: "readonly",
    dockerService: "app",
  }),
  defineSetting({
    key: "INGESTION_ADMIN_TOKEN",
    label: "Ingestion admin token",
    description:
      "Shared secret for service-to-service admin settings API (never expose to browser).",
    category: "infrastructure",
    type: "string",
    default: "",
    scope: "ingestion",
    applyMode: "restart",
    secret: true,
    dockerService: "all",
  }),
  defineSetting({
    key: "INGESTION_SETTINGS_CACHE_TTL_SECONDS",
    label: "Settings cache TTL (seconds)",
    description: "In-process cache TTL for resolved effective settings values.",
    category: "infrastructure",
    type: "integer",
    default: 30,
    scope: "both",
    applyMode: "runtime",
    min: 0,
    max: 3600,
    dockerService: "all",
  }),

  // --- site_policy (Phase 3 editor) ---
  defineSetting({
    key: "site_policy_overrides",
    label: "Site policy overrides",
    description: "JSON overrides merged onto the base site policy file (Phase 3 editor).",
    category: "site_policy",
    type: "json",
    default: "{}",
    scope: "both",
    applyMode: "runtime",
    dockerService: "all",
  }),

  // --- code_constants (runtime-tunable via admin console) ---
  defineSetting({
    key: "RACE_FETCH_CONCURRENCY",
    label: "Race fetch concurrency (initial)",
    description:
      "Adaptive race page fetch concurrency starting value (pipeline.py). Range 4 to 16.",
    category: "code_constants",
    type: "integer",
    default: 8,
    scope: "ingestion",
    applyMode: "runtime",
    min: 4,
    max: 16,
    dockerService: "liverc-ingestion-service",
  }),
  defineSetting({
    key: "INACTIVITY_TIMEOUT_SECONDS",
    label: "Ingestion inactivity timeout (seconds)",
    description: "Stall detection: no progress for this duration aborts ingestion.",
    category: "code_constants",
    type: "integer",
    default: 300,
    scope: "ingestion",
    applyMode: "runtime",
    min: 60,
    max: 3600,
    dockerService: "liverc-ingestion-service",
  }),
  defineSetting({
    key: "MAX_TOTAL_DURATION_SECONDS",
    label: "Max total ingestion duration (seconds)",
    description: "Hard cap on total wall time for a single ingestion run.",
    category: "code_constants",
    type: "integer",
    default: 3600,
    scope: "ingestion",
    applyMode: "runtime",
    min: 300,
    max: 86400,
    dockerService: "liverc-ingestion-service",
  }),
  defineSetting({
    key: "HTTPX_CONNECT_TIMEOUT_SECONDS",
    label: "HTTPX connect timeout (seconds)",
    description: "LiveRC HTTP client connect timeout (httpx_client.py).",
    category: "code_constants",
    type: "number",
    default: 5,
    scope: "ingestion",
    applyMode: "runtime",
    min: 1,
    max: 60,
    dockerService: "liverc-ingestion-service",
  }),
  defineSetting({
    key: "HTTPX_READ_TIMEOUT_SECONDS",
    label: "HTTPX read timeout (seconds)",
    description: "LiveRC HTTP client read timeout (httpx_client.py).",
    category: "code_constants",
    type: "number",
    default: 20,
    scope: "ingestion",
    applyMode: "runtime",
    min: 5,
    max: 120,
    dockerService: "liverc-ingestion-service",
  }),
  defineSetting({
    key: "HTTPX_MAX_RETRIES",
    label: "HTTPX max retries",
    description: "Maximum retry attempts for LiveRC HTTP requests.",
    category: "code_constants",
    type: "integer",
    default: 3,
    scope: "ingestion",
    applyMode: "runtime",
    min: 0,
    max: 10,
    dockerService: "liverc-ingestion-service",
  }),
]

export const INGESTION_SETTINGS_REGISTRY: IngestionSettingDefinition[] = REGISTRY_ENTRIES

export function toRegistryParityRecords(): RegistryParityRecord[] {
  return INGESTION_SETTINGS_REGISTRY.map(
    ({ key, type, default: defaultValue, applyMode, scope, category }) => ({
      key,
      type,
      default: defaultValue,
      applyMode,
      scope,
      category,
    })
  )
}

const REGISTRY_BY_KEY = new Map<string, IngestionSettingDefinition>(
  INGESTION_SETTINGS_REGISTRY.map((def) => [def.key, def])
)

/** Lookup a single setting definition by env/registry key. */
export function getSettingDefinition(key: string): IngestionSettingDefinition | undefined {
  return REGISTRY_BY_KEY.get(key)
}

/** All registered setting keys (stable sort). */
export function listSettingKeys(): string[] {
  return INGESTION_SETTINGS_REGISTRY.map((def) => def.key)
}

/** Registry entries grouped by category in display order. */
export function listByCategory(): IngestionSettingCategoryGroup[] {
  return INGESTION_SETTING_CATEGORY_ORDER.map((category) => ({
    category,
    label: INGESTION_SETTING_CATEGORY_LABELS[category],
    settings: INGESTION_SETTINGS_REGISTRY.filter((def) => def.category === category),
  })).filter((group) => group.settings.length > 0)
}

/** Keys exposed in admin GET responses (excludes pure secrets like admin token from listing optional). */
export function listAdminVisibleSettings(): IngestionSettingDefinition[] {
  return INGESTION_SETTINGS_REGISTRY.filter((def) => def.key !== "INGESTION_ADMIN_TOKEN")
}
