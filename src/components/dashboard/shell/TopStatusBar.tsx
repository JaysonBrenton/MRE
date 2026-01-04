"use client"

import { useState } from "react"
import UserProfileModal from "@/components/dashboard/shell/UserProfileModal"
import { useDashboardContext } from "@/components/dashboard/context/DashboardContext"

interface TopStatusBarProps {
  user?: {
    name?: string | null
    email?: string | null
    isAdmin?: boolean | null
  } | null
  userId: string
}

export default function TopStatusBar({ user, userId }: TopStatusBarProps) {
  const {
    openCommandPalette,
  } = useDashboardContext()

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[var(--token-border-muted)] bg-[var(--token-surface)]/95 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <button
              type="button"
              className="rounded-full border border-[var(--token-border-default)] px-4 py-2 text-xs font-semibold uppercase tracking-widest text-[var(--token-text-secondary)] transition hover:text-[var(--token-text-primary)]"
              onClick={openCommandPalette}
            >
              Navigate
            </button>
          </div>

          <div className="flex flex-1 items-center justify-end gap-4">

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(true)}
                className="flex items-center justify-center rounded-full border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-2"
                aria-haspopup="dialog"
                aria-expanded={isProfileModalOpen}
              >
                <svg className="h-5 w-5 text-[var(--token-text-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        userId={userId}
        user={user}
      />
    </>
  )
}
