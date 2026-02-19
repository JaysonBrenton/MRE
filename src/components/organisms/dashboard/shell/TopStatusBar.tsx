"use client"

import { useState } from "react"
import UserProfileModal from "@/components/organisms/dashboard/shell/UserProfileModal"
import Tooltip from "@/components/molecules/Tooltip"

interface TopStatusBarProps {
  user?: {
    name?: string | null
    email?: string | null
    isAdmin?: boolean | null
  } | null
  userId: string
}

export default function TopStatusBar({ user, userId }: TopStatusBarProps) {
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)

  return (
    <>
      <header className="fixed left-0 right-0 top-0 z-40 h-16 border-b border-[var(--token-border-muted)] bg-[var(--token-surface)]/95 backdrop-blur-xl lg:left-[var(--nav-width)]">
        <div className="flex h-full items-center justify-end px-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <div className="relative flex min-w-0 items-center">
              <Tooltip text="User Profile">
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(true)}
                  className="flex items-center gap-2 rounded-full border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] py-2.5 pl-3 pr-3 transition hover:border-[var(--token-accent)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                  aria-haspopup="dialog"
                  aria-expanded={isProfileModalOpen}
                  aria-label={user?.name ? `Open profile for ${user.name}` : "Open user profile"}
                >
                  {user?.name && (
                    <span
                      className="max-w-[120px] truncate text-sm font-medium text-[var(--token-text-primary)] sm:max-w-[180px]"
                      title={user.name}
                    >
                      {user.name}
                    </span>
                  )}
                  <span className="flex shrink-0">
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
                  </span>
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
