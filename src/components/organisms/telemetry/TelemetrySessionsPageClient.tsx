"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import Button from "@/components/atoms/Button"
import { typography } from "@/lib/typography"

const MAX_BYTES = 100 * 1024 * 1024

type SessionListItem = {
  id: string
  name: string | null
  status: string
  startTimeUtc: string
  endTimeUtc: string
  createdAt: string
  summary: { datasetCount: number; hasGnss: boolean }
}

type ListResponse = {
  items: SessionListItem[]
  nextCursor: string | null
}

async function parseJson<T>(
  res: Response
): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  const json = (await res.json()) as {
    success?: boolean
    data?: T
    error?: { message?: string }
  }
  if (!res.ok || json.success === false) {
    return { ok: false, message: json.error?.message || res.statusText || "Request failed" }
  }
  return { ok: true, data: json.data as T }
}

export default function TelemetrySessionsPageClient() {
  const [items, setItems] = useState<SessionListItem[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  const [importPhase, setImportPhase] = useState<"idle" | "uploading" | "processing" | "error">(
    "idle"
  )
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const res = await fetch("/api/v1/telemetry/sessions?limit=50", { credentials: "include" })
    const parsed = await parseJson<ListResponse>(res)
    if (!parsed.ok) {
      setListError(parsed.message)
      setItems([])
      setLoading(false)
      return
    }
    setItems(parsed.data.items)
    setNextCursor(parsed.data.nextCursor)
    setLoading(false)
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  const onFile = async (file: File | null) => {
    if (!file) return
    if (file.size > MAX_BYTES) {
      setImportPhase("error")
      setImportMessage("File is too large. Maximum size is 100 MB.")
      return
    }
    setImportPhase("uploading")
    setImportMessage("Uploading…")
    try {
      const create = await fetch("/api/v1/telemetry/uploads", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalFileName: file.name,
          contentType: file.type || "application/octet-stream",
        }),
      })
      const created = await parseJson<{
        uploadId: string
        uploadUrl: string
        method: string
      }>(create)
      if (!created.ok) {
        setImportPhase("error")
        setImportMessage(created.message)
        return
      }

      const put = await fetch(created.data.uploadUrl, {
        method: "PUT",
        credentials: "include",
        body: file,
      })
      if (!put.ok) {
        setImportPhase("error")
        setImportMessage("Upload failed. Check your connection and try again.")
        return
      }

      setImportPhase("processing")
      setImportMessage("Processing your session…")

      const fin = await fetch(`/api/v1/telemetry/uploads/${created.data.uploadId}/finalise`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name.replace(/\.[^/.]+$/, "") }),
      })
      const finJson = await parseJson<{
        sessionId: string
        sessionPollUrl?: string
      }>(fin)
      if (!finJson.ok) {
        setImportPhase("error")
        setImportMessage(finJson.message)
        return
      }

      window.location.href = `/eventAnalysis/my-telemetry/${finJson.data.sessionId}`
    } catch {
      setImportPhase("error")
      setImportMessage("Something went wrong. Try again.")
    }
  }

  return (
    <div
      className="box-border w-full min-w-full max-w-full space-y-8"
      style={{ minWidth: "20rem" }}
    >
      <header className="block w-full max-w-full text-left">
        <h1 className={`${typography.h1} w-full max-w-none text-[var(--token-text-primary)]`}>
          My Telemetry
        </h1>
        <p className={`${typography.bodySecondary} mt-2 w-full max-w-none`}>
          Import CSV or GPX, then review sessions and path previews (desktop).
        </p>
      </header>

      <section
        className="rounded-2xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-6 shadow-sm"
        style={{ minWidth: "20rem", width: "100%", boxSizing: "border-box" }}
      >
        <h2 className={`${typography.h3} text-[var(--token-text-primary)]`}>Import</h2>
        <p className={`${typography.bodySecondary} mt-2`}>
          Supported: CSV (GNSS) and GPX. One file per import for MVP.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.gpx,text/csv,application/gpx+xml,text/xml,application/xml"
            className="sr-only"
            aria-hidden
            tabIndex={-1}
            disabled={importPhase === "uploading" || importPhase === "processing"}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null
              e.target.value = ""
              void onFile(f)
            }}
          />
          <Button
            type="button"
            variant="default"
            disabled={importPhase !== "idle" && importPhase !== "error"}
            onClick={() => fileInputRef.current?.click()}
          >
            Choose file
          </Button>
          {importMessage ? (
            <span className={`${typography.bodySecondary}`}>{importMessage}</span>
          ) : null}
        </div>
        {importPhase === "error" && importMessage ? (
          <p className={`${typography.bodySecondary} mt-3 text-[var(--token-error)]`}>
            {importMessage}
          </p>
        ) : null}
      </section>

      <section style={{ minWidth: "20rem", width: "100%", boxSizing: "border-box" }}>
        <h2 className={`${typography.h3} text-[var(--token-text-primary)]`}>Sessions</h2>
        {loading ? (
          <p className={`${typography.bodySecondary} mt-4`}>Loading…</p>
        ) : listError ? (
          <p className={`${typography.bodySecondary} mt-4 text-[var(--token-error)]`}>
            {listError}
          </p>
        ) : items.length === 0 ? (
          <p className={`${typography.bodySecondary} mt-4`}>
            No telemetry sessions yet. Import a file above.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--token-border-muted)]">
                  <th className="py-2 pr-4 font-medium text-[var(--token-text-secondary)]">Name</th>
                  <th className="py-2 pr-4 font-medium text-[var(--token-text-secondary)]">
                    Status
                  </th>
                  <th className="py-2 pr-4 font-medium text-[var(--token-text-secondary)]">
                    Start (UTC)
                  </th>
                  <th className="py-2 pr-4 font-medium text-[var(--token-text-secondary)]">GNSS</th>
                  <th className="py-2 font-medium text-[var(--token-text-secondary)]" />
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.id} className="border-b border-[var(--token-border-muted)]/60">
                    <td className="py-3 pr-4 text-[var(--token-text-primary)]">
                      <Link
                        href={`/eventAnalysis/my-telemetry/${s.id}`}
                        className="text-[var(--token-accent)] hover:underline"
                      >
                        {s.name || "Untitled"}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 capitalize text-[var(--token-text-secondary)]">
                      {s.status}
                    </td>
                    <td className="py-3 pr-4 text-[var(--token-text-secondary)]">
                      {new Date(s.startTimeUtc).toLocaleString()}
                    </td>
                    <td className="py-3 pr-4 text-[var(--token-text-secondary)]">
                      {s.summary.hasGnss ? "Yes" : "—"}
                    </td>
                    <td className="py-3">
                      <Link
                        href={`/eventAnalysis/my-telemetry/${s.id}`}
                        className="text-[var(--token-accent)] hover:underline"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {nextCursor ? (
          <p className={`${typography.bodySecondary} mt-4`}>
            More results available (pagination deferred).
          </p>
        ) : null}
      </section>
    </div>
  )
}
