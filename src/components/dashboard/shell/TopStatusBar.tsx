"use client"

import { useState } from "react"
import UserProfileModal from "@/components/dashboard/shell/UserProfileModal"
import Tooltip from "@/components/ui/Tooltip"
import { useAppDispatch } from "@/store/hooks"
import { openCommandPalette } from "@/store/slices/uiSlice"

interface TopStatusBarProps {
  user?: {
    name?: string | null
    email?: string | null
    isAdmin?: boolean | null
  } | null
  userId: string
}

export default function TopStatusBar({ user, userId }: TopStatusBarProps) {
  const dispatch = useAppDispatch()

  const handleOpenCommandPalette = () => {
    dispatch(openCommandPalette())
  }

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[var(--token-border-muted)] bg-[var(--token-surface)]/95 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Tooltip text="Open navigation menu">
              <button
                type="button"
                className="flex items-center justify-center rounded-full border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-2 transition hover:border-[var(--token-accent)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                onClick={handleOpenCommandPalette}
                aria-label="Open navigation menu"
              >
                <svg
                  className="h-5 w-5 text-[var(--token-text-muted)]"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M3 12h18M3 6h18M3 18h18"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </Tooltip>

            {/* Clear selected event button moved to ChartControls component */}
          </div>

          <div className="flex flex-1 items-center justify-end gap-4">
            <div className="relative">
              <Tooltip text="User Profile">
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(true)}
                  className="flex items-center justify-center rounded-full border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-2 transition hover:border-[var(--token-accent)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                  aria-haspopup="dialog"
                  aria-expanded={isProfileModalOpen}
                  aria-label="Open user profile"
                >
                  <svg
                    className="h-5 w-5 text-[var(--token-text-muted)]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle cx="12" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </Tooltip>
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
