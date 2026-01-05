/**
 * @fileoverview User profile modal component
 *
 * @created 2025-01-28
 * @creator System
 * @lastModified 2025-01-28
 *
 * @description Modal component displaying comprehensive user profile information
 *
 * @purpose Provides a modal interface for viewing user profile data including
 *          basic information, activity statistics, driver linking status, UI
 *          preferences, account settings, and team information. Includes sign-out
 *          functionality in the footer.
 *
 * @relatedFiles
 * - src/components/ui/Modal.tsx (modal component)
 * - src/components/LogoutButton.tsx (sign-out button)
 * - src/app/api/v1/users/[userId]/profile/route.ts (API endpoint)
 * - src/core/users/profile.ts (core profile logic)
 */

"use client"

import { useEffect, useState } from "react"
import Modal from "@/components/ui/Modal"
import LogoutButton from "@/components/LogoutButton"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { setDensity } from "@/store/slices/uiSlice"
import type { UserProfile } from "@/core/users/profile"

interface UserProfileModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  user?: {
    name?: string | null
    email?: string | null
    isAdmin?: boolean | null
  } | null
}

type ProfileData = UserProfile | null

export default function UserProfileModal({ isOpen, onClose, userId, user }: UserProfileModalProps) {
  const dispatch = useAppDispatch()
  const density = useAppSelector((state) => state.ui.density)

  const handleSetDensity = (value: Parameters<typeof setDensity>[0]) => {
    dispatch(setDensity(value))
  }
  const [profileData, setProfileData] = useState<ProfileData>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLight, setIsLight] = useState(false)

  useEffect(() => {
    if (!isOpen || !userId) {
      return
    }

    const fetchProfile = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/v1/users/${userId}/profile`, {
          cache: "no-store",
        })

        if (!response.ok) {
          throw new Error("Failed to load profile data")
        }

        const result = await response.json()

        if (result.success && result.data) {
          setProfileData(result.data)
        } else {
          throw new Error("Invalid response from server")
        }
      } catch (err) {
        console.error("Error fetching user profile", err)
        setError(err instanceof Error ? err.message : "Failed to load profile")
      } finally {
        setIsLoading(false)
      }
    }

    fetchProfile()
  }, [isOpen, userId])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    // Read saved theme preference
    const savedTheme = window.localStorage.getItem("mre-theme")
    const prefersLight = savedTheme === "light"
    setIsLight(prefersLight)
  }, [])

  const toggleTheme = (theme: "light" | "dark") => {
    const newIsLight = theme === "light"
    setIsLight(newIsLight)

    if (newIsLight) {
      document.documentElement.classList.add("light")
      localStorage.setItem("mre-theme", "light")
    } else {
      document.documentElement.classList.remove("light")
      localStorage.setItem("mre-theme", "dark")
    }
  }

  const formatTime = (seconds: number | null): string => {
    if (seconds === null) return "—"
    const minutes = Math.floor(seconds / 60)
    const secs = (seconds % 60).toFixed(3)
    return `${minutes}:${secs.padStart(6, "0")}`
  }

  const formatDate = (date: Date | string): string => {
    const d = typeof date === "string" ? new Date(date) : date
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-green-500/20 text-green-500"
      case "suggested":
        return "bg-yellow-500/20 text-yellow-500"
      case "rejected":
        return "bg-red-500/20 text-red-500"
      case "conflict":
        return "bg-orange-500/20 text-orange-500"
      default:
        return "bg-[var(--token-surface-elevated)] text-[var(--token-text-muted)]"
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="User Profile"
      maxWidth="2xl"
      ariaLabel="User profile modal"
      footer={
        <div className="flex justify-end">
          <LogoutButton variant="compact" />
        </div>
      }
    >
      <div className="px-4 py-4 space-y-6">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-sm text-[var(--token-text-muted)]">Loading profile...</div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        {!isLoading && !error && profileData && (
          <>
            {/* Header Section */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-[var(--token-text-primary)]">
                  {profileData.user.driverName}
                </h3>
                {profileData.user.isAdmin && (
                  <span className="rounded-full bg-[var(--token-accent)]/20 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-[var(--token-accent)]">
                    Admin
                  </span>
                )}
              </div>
              <p className="text-sm text-[var(--token-text-muted)]">{profileData.user.email}</p>
            </div>

            <div className="h-px bg-[var(--token-border-muted)]" />

            {/* Basic Information */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-[var(--token-text-secondary)]">
                Basic Information
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-[var(--token-text-muted)]">Driver Name</p>
                  <p className="text-sm font-medium text-[var(--token-text-primary)]">
                    {profileData.user.driverName}
                  </p>
                </div>
                {profileData.user.teamName && (
                  <div>
                    <p className="text-xs text-[var(--token-text-muted)]">Team Name</p>
                    <p className="text-sm font-medium text-[var(--token-text-primary)]">
                      {profileData.user.teamName}
                    </p>
                  </div>
                )}
                {profileData.user.persona && (
                  <div>
                    <p className="text-xs text-[var(--token-text-muted)]">Persona</p>
                    <p className="text-sm font-medium text-[var(--token-text-primary)]">
                      {profileData.user.persona.name}
                    </p>
                  </div>
                )}
                {profileData.user.transponderNumber && (
                  <div>
                    <p className="text-xs text-[var(--token-text-muted)]">Transponder</p>
                    <p className="text-sm font-medium text-[var(--token-text-primary)]">
                      {profileData.user.transponderNumber}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="h-px bg-[var(--token-border-muted)]" />

            {/* Activity Statistics */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-[var(--token-text-secondary)]">
                Activity Statistics
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-3">
                  <p className="text-xs text-[var(--token-text-muted)]">Events</p>
                  <p className="text-lg font-semibold text-[var(--token-text-primary)]">
                    {profileData.activityStats.eventCount}
                  </p>
                </div>
                <div className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-3">
                  <p className="text-xs text-[var(--token-text-muted)]">Races</p>
                  <p className="text-lg font-semibold text-[var(--token-text-primary)]">
                    {profileData.activityStats.raceCount}
                  </p>
                </div>
                {profileData.activityStats.bestLapTime !== null && (
                  <div className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-3">
                    <p className="text-xs text-[var(--token-text-muted)]">Best Lap Time</p>
                    <p className="text-lg font-semibold text-[var(--token-text-primary)]">
                      {formatTime(profileData.activityStats.bestLapTime)}
                    </p>
                  </div>
                )}
                {profileData.activityStats.bestAvgLapTime !== null && (
                  <div className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-3">
                    <p className="text-xs text-[var(--token-text-muted)]">Best Avg Lap</p>
                    <p className="text-lg font-semibold text-[var(--token-text-primary)]">
                      {formatTime(profileData.activityStats.bestAvgLapTime)}
                    </p>
                  </div>
                )}
                {profileData.activityStats.bestConsistency !== null && (
                  <div className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-3">
                    <p className="text-xs text-[var(--token-text-muted)]">Best Consistency</p>
                    <p className="text-lg font-semibold text-[var(--token-text-primary)]">
                      {profileData.activityStats.bestConsistency.toFixed(2)}%
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Driver Linking */}
            {profileData.driverLinks.length > 0 && (
              <>
                <div className="h-px bg-[var(--token-border-muted)]" />
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-[var(--token-text-secondary)]">
                    Driver Linking
                  </h4>
                  <div className="space-y-2">
                    {profileData.driverLinks.map((link) => (
                      <div
                        key={link.driverId}
                        className="flex items-center justify-between rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-3"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium text-[var(--token-text-primary)]">
                            {link.driverName}
                          </p>
                          <p className="text-xs text-[var(--token-text-muted)]">
                            {link.eventCount} event{link.eventCount !== 1 ? "s" : ""} •{" "}
                            {link.matchType} match
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-wider ${getStatusBadgeColor(link.status)}`}
                        >
                          {link.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="h-px bg-[var(--token-border-muted)]" />

            {/* UI Preferences */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-[var(--token-text-secondary)]">
                UI Preferences
              </h4>
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-xs text-[var(--token-text-muted)]">Density</p>
                  <div className="flex items-center gap-2">
                    {[
                      { id: "compact", label: "Compact" },
                      { id: "comfortable", label: "Comfort" },
                      { id: "spacious", label: "Spacious" },
                    ].map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() =>
                          handleSetDensity(option.id as "compact" | "comfortable" | "spacious")
                        }
                        className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-wide transition ${
                          density === option.id
                            ? "bg-[var(--token-accent)]/20 text-[var(--token-accent)]"
                            : "border border-[var(--token-border-default)] text-[var(--token-text-muted)] hover:text-[var(--token-text-primary)] hover:border-[var(--token-border-default)]"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-[var(--token-text-muted)]">Theme</p>
                  <div className="flex items-center gap-2">
                    {[
                      { id: "dark", label: "Dark" },
                      { id: "light", label: "Light" },
                    ].map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => toggleTheme(option.id as "light" | "dark")}
                        className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-wide transition ${
                          (option.id === "light" && isLight) || (option.id === "dark" && !isLight)
                            ? "bg-[var(--token-accent)]/20 text-[var(--token-accent)]"
                            : "border border-[var(--token-border-default)] text-[var(--token-text-muted)] hover:text-[var(--token-text-primary)] hover:border-[var(--token-border-default)]"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="h-px bg-[var(--token-border-muted)]" />

            {/* Account Settings */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-[var(--token-text-secondary)]">
                Account Settings
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-[var(--token-text-muted)]">Email</p>
                  <p className="text-sm font-medium text-[var(--token-text-primary)]">
                    {profileData.user.email}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--token-text-muted)]">Account Created</p>
                  <p className="text-sm font-medium text-[var(--token-text-primary)]">
                    {formatDate(profileData.user.createdAt)}
                  </p>
                </div>
              </div>
            </div>

            {/* Team Information */}
            {profileData.user.teamName && (
              <>
                <div className="h-px bg-[var(--token-border-muted)]" />
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-[var(--token-text-secondary)]">
                    Team Information
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-[var(--token-text-muted)]">Team Name</p>
                      <p className="text-sm font-medium text-[var(--token-text-primary)]">
                        {profileData.user.teamName}
                      </p>
                    </div>
                    {profileData.user.isTeamManager && (
                      <div>
                        <p className="text-xs text-[var(--token-text-muted)]">Role</p>
                        <p className="text-sm font-medium text-[var(--token-text-primary)]">
                          Team Manager
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
