"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import LogoutButton from "@/components/LogoutButton"
import { useDashboardContext } from "@/components/dashboard/context/DashboardContext"

interface TopStatusBarProps {
  user?: {
    name?: string | null
    email?: string | null
    isAdmin?: boolean | null
  } | null
}

export default function TopStatusBar({ user }: TopStatusBarProps) {
  const {
    density,
    setDensity,
    openCommandPalette,
  } = useDashboardContext()

  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!profileOpen) {
      return
    }

    const handleClick = (event: MouseEvent) => {
      if (!profileRef.current) {
        return
      }
      if (!profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false)
      }
    }

    document.addEventListener("click", handleClick)
    return () => document.removeEventListener("click", handleClick)
  }, [profileOpen])

  const densityOptions = [
    { id: "compact", label: "Compact" },
    { id: "comfortable", label: "Comfort" },
    { id: "spacious", label: "Spacious" },
  ] as const

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--token-border-muted)] bg-[var(--token-surface)]/95 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between px-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <Link href="/dashboard" className="text-lg font-bold tracking-[0.4em] text-[var(--token-text-primary)]">
            MRE
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-end gap-4">
          <button
            type="button"
            className="hidden rounded-full border border-[var(--token-border-default)] px-4 py-2 text-xs font-semibold uppercase tracking-widest text-[var(--token-text-secondary)] transition hover:text-[var(--token-text-primary)] md:inline-flex"
            onClick={openCommandPalette}
          >
            Navigate
          </button>

          <div className="hidden items-center gap-1 lg:flex">
            {densityOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setDensity(option.id)}
                className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-wide transition ${
                  density === option.id
                    ? "bg-[var(--token-accent)]/20 text-[var(--token-accent)]"
                    : "text-[var(--token-text-muted)] hover:text-[var(--token-text-primary)]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => setProfileOpen((prev) => !prev)}
              className="flex items-center gap-2 rounded-full border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-3 py-1 text-left"
              aria-haspopup="true"
              aria-expanded={profileOpen}
            >
              <div className="hidden text-left lg:block">
                <p className="text-sm font-semibold text-[var(--token-text-primary)]">{user?.name ?? "Driver"}</p>
              </div>
              <svg className="h-4 w-4 text-[var(--token-text-muted)]" viewBox="0 0 24 24" fill="none">
                <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
              </svg>
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-3 w-56 rounded-2xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-4 shadow-2xl">
                <p className="text-sm font-semibold text-[var(--token-text-primary)]">{user?.name ?? "Driver"}</p>
                <p className="text-xs text-[var(--token-text-muted)]">{user?.email ?? "driver@mre.app"}</p>
                <div className="my-3 h-px bg-[var(--token-border-muted)]" />
                <LogoutButton variant="compact" />
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
