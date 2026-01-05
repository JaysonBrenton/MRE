"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import UserProfileModal from "@/components/dashboard/shell/UserProfileModal"
import EventSearchModal from "@/components/dashboard/shell/EventSearchModal"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { openCommandPalette } from "@/store/slices/uiSlice"
import { selectEvent, clearEvent } from "@/store/slices/dashboardSlice"

interface TopStatusBarProps {
  user?: {
    name?: string | null
    email?: string | null
    isAdmin?: boolean | null
  } | null
  userId: string
}

export default function TopStatusBar({ user, userId }: TopStatusBarProps) {
  const pathname = usePathname()
  const dispatch = useAppDispatch()
  const selectedEventId = useAppSelector((state) => state.dashboard.selectedEventId)
  const eventData = useAppSelector((state) => state.dashboard.eventData)

  const isDashboardRoute = pathname === "/dashboard"

  const handleOpenCommandPalette = () => {
    dispatch(openCommandPalette())
  }

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [isEventSearchModalOpen, setIsEventSearchModalOpen] = useState(false)

  const handleSelectEvent = (eventId: string | null) => {
    if (eventId) {
      dispatch(selectEvent(eventId))
    } else {
      dispatch(clearEvent())
    }
  }

  const selectedEventName = eventData?.event?.eventName ?? null
  const eventButtonTooltip = selectedEventName
    ? `Selected: ${selectedEventName}`
    : "Select or change event"

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[var(--token-border-muted)] bg-[var(--token-surface)]/95 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <button
              type="button"
              className="flex items-center justify-center rounded-full border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-2 transition hover:border-[var(--token-accent)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
              onClick={handleOpenCommandPalette}
              aria-label="Open navigation menu"
              title="Open navigation menu"
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

            {isDashboardRoute && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEventSearchModalOpen(true)}
                  className="flex items-center justify-center rounded-full border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-2 transition hover:border-[var(--token-accent)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                  aria-label={eventButtonTooltip}
                  title={eventButtonTooltip}
                >
                  <svg
                    className="h-5 w-5 text-[var(--token-text-muted)]"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>

                {selectedEventId && (
                  <button
                    type="button"
                    onClick={() => handleSelectEvent(null)}
                    className="flex items-center justify-center rounded-full border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-2 transition hover:border-[var(--token-accent)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                    aria-label="Clear selected event"
                    title="Clear selected event"
                  >
                    <svg
                      className="h-5 w-5 text-[var(--token-text-muted)]"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M18 6L6 18M6 6l12 12"
                        stroke="currentColor"
                        strokeWidth={1.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-1 items-center justify-end gap-4">
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(true)}
                className="flex items-center justify-center rounded-full border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-2 transition hover:border-[var(--token-accent)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                aria-haspopup="dialog"
                aria-expanded={isProfileModalOpen}
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

      <EventSearchModal
        isOpen={isEventSearchModalOpen}
        onClose={() => setIsEventSearchModalOpen(false)}
        onSelectEvent={handleSelectEvent}
        selectedEventId={selectedEventId}
      />
    </>
  )
}
