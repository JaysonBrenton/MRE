"use client"

import { Menu, User } from "lucide-react"
import { useState } from "react"
import UserProfileModal from "@/components/organisms/dashboard/shell/UserProfileModal"
import Tooltip from "@/components/molecules/Tooltip"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { toggleMobileNav } from "@/store/slices/uiSlice"
import { DASHBOARD_SHELL_CONTENT_HORIZONTAL_PADDING } from "@/components/organisms/dashboard/shell/dashboard-shell-content-horizontal-padding"
import { DASHBOARD_NAV_FIXED_LEFT_TRANSITION_CLASS } from "@/components/organisms/dashboard/shell/dashboard-shell-nav-transition"

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
  const dispatch = useAppDispatch()
  const isMobileNavOpen = useAppSelector((state) => state.ui.isMobileNavOpen)

  return (
    <>
      <header
        className={`fixed left-0 right-0 top-0 z-40 h-16 bg-[color-mix(in_oklab,var(--token-surface-page)_96%,transparent)] backdrop-blur-xl supports-[backdrop-filter]:bg-[color-mix(in_oklab,var(--token-surface-page)_88%,transparent)] lg:left-[calc(var(--nav-width)_+_var(--nav-content-gutter))] ${DASHBOARD_NAV_FIXED_LEFT_TRANSITION_CLASS}`}
      >
        <div className="flex h-full w-full items-center px-3 sm:px-6">
          <div className="flex flex-1 items-center">
            <button
              type="button"
              className="rounded-md border border-[var(--token-border-default)] p-2 text-[var(--token-text-secondary)] transition hover:border-[var(--token-accent)] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] lg:hidden"
              onClick={() => dispatch(toggleMobileNav())}
              aria-label={isMobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={isMobileNavOpen}
              aria-controls="dashboard-navigation-rail"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>
          </div>
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
                    <User className="h-5 w-5 text-[var(--token-text-muted)]" aria-hidden="true" />
                  </span>
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-0 ${DASHBOARD_SHELL_CONTENT_HORIZONTAL_PADDING}`}
          aria-hidden
        >
          <div className="h-px w-full bg-[var(--token-border-muted)]" />
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
