/**
 * @fileoverview Admin ingestion settings console with optional write support (Phase 2)
 */

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type {
  AdminIngestionSetting,
  AdminIngestionSettingsCategory,
} from "@/core/admin/ingestion-settings"
import { formatValueForDisplay } from "@/core/admin/ingestion-settings-value"
import { validateSitePolicyOverrides } from "@/core/admin/site-policy-merge"

type DraftValues = Record<string, string | number | boolean>

function SourceBadge({ source }: { source: AdminIngestionSetting["source"] }) {
  const label =
    source === "environment" ? "Environment" : source === "database" ? "Database" : "Default"
  return (
    <span className="inline-flex rounded-full bg-[var(--token-surface-elevated)] px-2 py-0.5 text-xs font-medium text-[var(--token-text-secondary)]">
      {label}
    </span>
  )
}

function ApplyModeBadge({ applyMode }: { applyMode: AdminIngestionSetting["applyMode"] }) {
  const label =
    applyMode === "runtime" ? "Runtime" : applyMode === "restart" ? "Restart required" : "Read-only"
  return (
    <span className="inline-flex rounded-full border border-[var(--token-border-default)] px-2 py-0.5 text-xs font-medium text-[var(--token-text-muted)]">
      {label}
    </span>
  )
}

function inputValue(setting: AdminIngestionSetting, draft: DraftValues): string {
  const value = draft[setting.key] ?? setting.effectiveValue
  if (typeof value === "boolean") return value ? "true" : "false"
  return String(value)
}

function parseDraftInput(setting: AdminIngestionSetting, raw: string): string | number | boolean {
  if (setting.type === "boolean") return raw === "true"
  if (setting.type === "integer") return Number.parseInt(raw, 10)
  if (setting.type === "number") return Number.parseFloat(raw)
  if (setting.type === "json") return raw
  return raw
}

function draftMatchesEffective(
  setting: AdminIngestionSetting,
  draftValue: string | number | boolean,
  effective: AdminIngestionSetting["effectiveValue"]
): boolean {
  if (setting.type === "json") {
    try {
      return (
        JSON.stringify(JSON.parse(String(draftValue))) ===
        JSON.stringify(JSON.parse(String(effective)))
      )
    } catch {
      return String(draftValue) === String(effective)
    }
  }
  return String(draftValue) === String(effective)
}

export default function IngestionSettingsConsole() {
  const [settings, setSettings] = useState<AdminIngestionSetting[]>([])
  const [categories, setCategories] = useState<AdminIngestionSettingsCategory[]>([])
  const [writable, setWritable] = useState(false)
  const [draft, setDraft] = useState<DraftValues>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [confirmToken, setConfirmToken] = useState<string | undefined>(undefined)

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/v1/admin/ingestion/settings")
      const data = await response.json()
      if (!response.ok || !data.success) {
        setError(data.error?.message || "Failed to load ingestion settings")
        return
      }
      setSettings(data.data.settings)
      setCategories(data.data.categories)
      setWritable(Boolean(data.data.writable))
      setDraft({})
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const settingsByCategory = useMemo(() => {
    const grouped = new Map<string, AdminIngestionSetting[]>()
    for (const setting of settings) {
      const list = grouped.get(setting.category) ?? []
      list.push(setting)
      grouped.set(setting.category, list)
    }
    return grouped
  }, [settings])

  const dirtyKeys = useMemo(() => {
    return settings
      .filter((setting) => {
        if (!(setting.key in draft)) return false
        return !draftMatchesEffective(setting, draft[setting.key], setting.effectiveValue)
      })
      .map((s) => s.key)
  }, [draft, settings])

  const needsConfirm = useMemo(() => {
    for (const setting of settings) {
      if (!(setting.key in draft)) continue
      const next = draft[setting.key]
      if (
        setting.confirmWhen === "disable_scrape" &&
        setting.key === "MRE_SCRAPE_ENABLED" &&
        next === false
      ) {
        return "disable_scrape"
      }
      if (
        setting.confirmWhen === "unlimited_ingests" &&
        setting.key === "MRE_RECENT_EVENTS_MAX_INGESTS" &&
        Number(next) === 0
      ) {
        return "unlimited_ingests"
      }
      if (
        setting.confirmWhen === "disable_queue" &&
        setting.key === "INGESTION_USE_QUEUE" &&
        next === false
      ) {
        return "disable_queue"
      }
    }
    return undefined
  }, [draft, settings])

  async function handleSave() {
    if (dirtyKeys.length === 0) return
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const updates = dirtyKeys.map((key) => {
        const setting = settings.find((s) => s.key === key)
        if (!setting) throw new Error(`Missing setting ${key}`)
        return { key, value: draft[key] ?? setting.effectiveValue }
      })

      const response = await fetch("/api/v1/admin/ingestion/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates,
          confirmToken: needsConfirm ? (confirmToken ?? needsConfirm) : undefined,
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        setError(data.error?.message || "Failed to save settings")
        return
      }
      setSettings(data.data.settings.settings)
      setCategories(data.data.settings.categories)
      setWritable(Boolean(data.data.settings.writable))
      setDraft({})
      setConfirmToken(undefined)
      setMessage(`Updated ${data.data.updated.length} setting(s).`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setSaving(false)
    }
  }

  async function handleReset(key: string) {
    setSaving(true)
    setError(null)
    try {
      const setting = settings.find((s) => s.key === key)
      if (!setting) return
      const response = await fetch("/api/v1/admin/ingestion/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: [{ key, value: setting.defaultValue }],
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        setError(data.error?.message || "Failed to reset setting")
        return
      }
      setSettings(data.data.settings.settings)
      setCategories(data.data.settings.categories)
      setDraft((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      setMessage(`Reset ${key} to default.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-[var(--token-text-secondary)]">Loading settings…</p>
  }

  if (error && settings.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-[var(--token-text-error)]">{error}</p>
        <button
          type="button"
          onClick={fetchSettings}
          className="rounded-md bg-[var(--token-interactive-primary)] px-4 py-2 text-sm font-medium text-white"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-[var(--token-text-secondary)]">
        {writable
          ? "Runtime settings save to the database and take effect without a container restart."
          : "Read-only mode (ADMIN_INGESTION_SETTINGS_WRITABLE=false)."}
      </p>

      {error ? <p className="text-sm text-[var(--token-text-error)]">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p> : null}

      {writable && dirtyKeys.length > 0 ? (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-4 shadow-sm">
          <span className="text-sm text-[var(--token-text-secondary)]">
            {dirtyKeys.length} unsaved change{dirtyKeys.length === 1 ? "" : "s"}
          </span>
          {needsConfirm ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={confirmToken === needsConfirm}
                onChange={(e) => setConfirmToken(e.target.checked ? needsConfirm : undefined)}
              />
              Confirm: {needsConfirm.replace(/_/g, " ")}
            </label>
          ) : null}
          <button
            type="button"
            disabled={saving || (needsConfirm ? confirmToken !== needsConfirm : false)}
            onClick={handleSave}
            className="rounded-md bg-[var(--token-interactive-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            onClick={() => setDraft({})}
            className="text-sm text-[var(--token-text-muted)]"
          >
            Discard
          </button>
        </div>
      ) : null}

      {categories.map((category) => {
        const categorySettings = settingsByCategory.get(category.id) ?? []
        if (categorySettings.length === 0) return null

        return (
          <section
            key={category.id}
            className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-5"
          >
            <h2 className="text-lg font-semibold text-[var(--token-text-primary)] mb-4">
              {category.label}
            </h2>
            {category.id === "telemetry" ? (
              <p className="mb-4 text-sm text-[var(--token-text-secondary)]">
                Telemetry settings apply to the{" "}
                <code className="text-xs">mre-telemetry-worker</code> container. After changing
                restart-mode keys, restart that service for changes to take effect.
              </p>
            ) : null}
            {category.id === "site_policy" ? (
              <p className="mb-4 text-sm text-[var(--token-text-secondary)]">
                Overrides merge onto the base policy file at runtime. Host rules match by pattern;
                partial overrides update only the fields you specify.
              </p>
            ) : null}
            <div className="space-y-4">
              {categorySettings.map((setting) => (
                <div
                  key={setting.key}
                  className="rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium text-[var(--token-text-primary)]">
                        {setting.label}
                      </h3>
                      <p className="mt-1 text-xs font-mono text-[var(--token-text-muted)]">
                        {setting.key}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <SourceBadge source={setting.source} />
                      <ApplyModeBadge applyMode={setting.applyMode} />
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-[var(--token-text-secondary)]">
                    {setting.description}
                  </p>

                  {writable && setting.writable ? (
                    <div className="mt-3 space-y-2">
                      {setting.type === "boolean" ? (
                        <select
                          className="w-full rounded border border-[var(--token-border-default)] bg-[var(--token-surface)] px-3 py-2 text-sm"
                          value={inputValue(setting, draft)}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              [setting.key]: parseDraftInput(setting, e.target.value),
                            }))
                          }
                        >
                          <option value="true">true</option>
                          <option value="false">false</option>
                        </select>
                      ) : setting.type === "json" ? (
                        <>
                          <textarea
                            className="min-h-[12rem] w-full rounded border border-[var(--token-border-default)] bg-[var(--token-surface)] px-3 py-2 font-mono text-sm"
                            value={inputValue(setting, draft)}
                            spellCheck={false}
                            onChange={(e) =>
                              setDraft((prev) => ({
                                ...prev,
                                [setting.key]: e.target.value,
                              }))
                            }
                          />
                          {setting.key in draft &&
                          validateSitePolicyOverrides(draft[setting.key]) ? (
                            <p className="text-xs text-[var(--token-text-error)]">
                              {validateSitePolicyOverrides(draft[setting.key])}
                            </p>
                          ) : null}
                        </>
                      ) : setting.enumValues ? (
                        <select
                          className="w-full rounded border border-[var(--token-border-default)] bg-[var(--token-surface)] px-3 py-2 text-sm"
                          value={inputValue(setting, draft)}
                          onChange={(e) =>
                            setDraft((prev) => ({ ...prev, [setting.key]: e.target.value }))
                          }
                        >
                          {setting.enumValues.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className="w-full rounded border border-[var(--token-border-default)] bg-[var(--token-surface)] px-3 py-2 text-sm font-mono"
                          value={inputValue(setting, draft)}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              [setting.key]: parseDraftInput(setting, e.target.value),
                            }))
                          }
                        />
                      )}
                      {setting.source === "database" ? (
                        <button
                          type="button"
                          className="text-xs text-[var(--token-text-muted)] underline"
                          onClick={() => handleReset(setting.key)}
                          disabled={saving}
                        >
                          Reset to default
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {setting.applyMode !== "runtime" ? (
                        <p className="text-xs text-[var(--token-text-muted)]">
                          {setting.applyMode === "restart"
                            ? "Requires container restart to change. Set the environment variable on the target service."
                            : "Read-only in this console. Value comes from code or infrastructure."}
                        </p>
                      ) : null}
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-[var(--token-text-muted)]">
                            Effective value
                          </p>
                          <pre className="mt-1 overflow-x-auto rounded bg-[var(--token-surface)] p-2 text-sm text-[var(--token-text-primary)]">
                            {formatValueForDisplay(setting.effectiveValue)}
                          </pre>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-[var(--token-text-muted)]">
                            Default
                          </p>
                          <pre className="mt-1 overflow-x-auto rounded bg-[var(--token-surface)] p-2 text-sm text-[var(--token-text-secondary)]">
                            {formatValueForDisplay(setting.defaultValue)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
