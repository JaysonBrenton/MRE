/**
 * @fileoverview Check LiveRC button component
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Button to manually trigger LiveRC discovery
 * 
 * @purpose Provides a prominent button for users to manually check LiveRC
 *          for new events, even if DB results exist.
 * 
 * @relatedFiles
 * - src/components/event-search/EventSearchContainer.tsx (parent component)
 */

"use client"

export interface CheckLiveRCButtonProps {
  onClick: () => void
  isLoading?: boolean
}

export default function CheckLiveRCButton({ onClick, isLoading }: CheckLiveRCButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      className="mobile-button w-full sm:w-auto flex items-center justify-center rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-4 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed sm:px-5 h-11"
    >
      {isLoading ? "Checking LiveRC..." : "Check LiveRC"}
    </button>
  )
}

