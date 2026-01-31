"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { closeCommandPalette } from "@/store/slices/uiSlice"

const COMMANDS = [
  { id: "dashboard", label: "Go to My Event Analysis", action: "/dashboard" },
  { id: "event", label: "View My Event", action: "/dashboard/my-event" },
  { id: "search", label: "Open Search", action: "/search" },
  { id: "telemetry", label: "Telemetry Workspace", action: "/dashboard/my-telemetry" },
  { id: "engineer", label: "My Engineer", action: "/dashboard/my-engineer" },
  { id: "team", label: "My Team", action: "/under-development" },
  { id: "club", label: "My Club", action: "/under-development" },
]

export default function CommandPalette() {
  const dispatch = useAppDispatch()
  const isCommandPaletteOpen = useAppSelector((state) => state.ui.isCommandPaletteOpen)

  const handleCloseCommandPalette = () => {
    dispatch(closeCommandPalette())
  }

  if (!isCommandPaletteOpen) {
    return null
  }

  return <PaletteDialog onRequestClose={handleCloseCommandPalette} />
}

function PaletteDialog({ onRequestClose }: { onRequestClose: () => void }) {
  const [query, setQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    const timeout = setTimeout(() => inputRef.current?.focus(), 10)
    return () => clearTimeout(timeout)
  }, [])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onRequestClose()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onRequestClose])

  const results = useMemo(() => {
    if (!query) return COMMANDS
    const lower = query.toLowerCase()
    return COMMANDS.filter((command) => command.label.toLowerCase().includes(lower))
  }, [query])

  const execute = (action: string) => {
    router.push(action)
    onRequestClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 py-24"
      onClick={onRequestClose}
      style={{ minWidth: 0 }}
    >
      <div
        className="rounded-3xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-4 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "36rem",
          minWidth: "20rem",
          boxSizing: "border-box",
          flexShrink: 0,
          flexGrow: 0,
        }}
      >
        <div className="flex items-center gap-2 rounded-2xl border border-[var(--token-border-default)] bg-[var(--token-surface)] px-3 py-2">
          <svg className="h-4 w-4 text-[var(--token-text-muted)]" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth={1.5} />
            <path
              d="m20 20-3.5-3.5"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Jump to anything…"
            className="flex-1 border-none bg-transparent text-sm text-[var(--token-text-primary)] placeholder:text-[var(--token-text-muted)] focus:outline-none"
          />
          <span className="text-[11px] uppercase tracking-widest text-[var(--token-text-muted)]">
            Esc
          </span>
        </div>

        <div className="mt-4 space-y-2">
          {results.map((command) => (
            <button
              key={command.id}
              type="button"
              onClick={() => execute(command.action)}
              className="flex w-full items-center justify-between rounded-2xl border border-transparent px-3 py-2 text-left transition hover:border-[var(--token-border-default)] hover:bg-[var(--token-surface-raised)]"
            >
              <span className="text-sm font-semibold text-[var(--token-text-primary)]">
                {command.label}
              </span>
            </button>
          ))}
          {results.length === 0 && (
            <p className="text-center text-sm text-[var(--token-text-muted)]">
              No commands match “{query}”.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
