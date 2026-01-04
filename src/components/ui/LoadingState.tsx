/**
 * @fileoverview Loading State component following MRE design system
 * 
 * @created 2025-01-27
 * @creator UI Review Implementation
 * @lastModified 2025-01-27
 * 
 * @description Standard loading state component with consistent patterns
 * 
 * @purpose Provides consistent loading states across the application
 * 
 * @relatedFiles
 * - docs/design/mre-dark-theme-guidelines.md (theme tokens)
 */

export interface LoadingStateProps {
  message?: string
  className?: string
}

export interface SkeletonProps {
  className?: string
  lines?: number
}

/**
 * Standard loading state component.
 * 
 * Provides consistent loading text pattern.
 */
export function LoadingState({ message = "Loading...", className = "" }: LoadingStateProps) {
  return (
    <div className={`text-center py-8 text-[var(--token-text-secondary)] w-full min-w-0 ${className}`} role="status" aria-live="polite">
      <p>{message}</p>
    </div>
  )
}

/**
 * Skeleton loader component for content areas.
 * 
 * Provides consistent skeleton loading pattern using surface tokens.
 */
export function Skeleton({ className = "", lines = 1 }: SkeletonProps) {
  return (
    <div className={className}>
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className="animate-pulse h-4 bg-[var(--token-surface)] rounded mb-2"
          style={{ width: index === lines - 1 ? "75%" : "100%" }}
        />
      ))}
    </div>
  )
}

