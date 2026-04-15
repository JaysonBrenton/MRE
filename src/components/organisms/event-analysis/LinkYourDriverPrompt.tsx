/**
 * @fileoverview Prompt to link driver profile for practice day
 *
 * @description Shown when viewing a practice day and user has not linked a driver.
 *              Encourages connecting driver profile to see personalized lap times and comparison.
 */

"use client"

import { typography } from "@/lib/typography"

export interface LinkYourDriverPromptProps {
  className?: string
}

export default function LinkYourDriverPrompt({ className = "" }: LinkYourDriverPromptProps) {
  return (
    <div
      className={`rounded-lg border border-[var(--token-border-accent-soft)] bg-[var(--token-surface-raised)] p-6 ${className}`}
      role="region"
      aria-labelledby="link-driver-heading"
    >
      <h2 id="link-driver-heading" className={typography.h4}>
        Link your driver to see your practice day
      </h2>
      <p className={`mt-2 ${typography.bodySecondary}`}>
        Connect your driver profile to view your lap times, progression, and class comparison.
      </p>
      <p className={`mt-2 ${typography.bodyMuted}`}>
        You can still browse all sessions below. Use the driver selector above to view any
        driver&apos;s data.
      </p>
    </div>
  )
}
