/**
 * @fileoverview Footer component with copyright and version badge
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Reusable footer component for authenticated pages
 *
 * @purpose Provides consistent footer with copyright and version badge
 *          across all authenticated pages. Scrolls with content (not sticky).
 *
 * @relatedFiles
 * - docs/design/mre-mobile-ux-guidelines.md (mobile requirements)
 * - docs/design/mre-dark-theme-guidelines.md (theme tokens)
 */

export default function Footer() {
  return (
    <footer className="mt-12 flex h-16 shrink-0 items-center border-t border-[var(--token-border-muted)] bg-[var(--token-surface-page)]">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6">
        <p className="text-sm text-[var(--token-text-muted)]">© 2025 My Race Engineer</p>
        <p className="text-sm text-[var(--token-text-muted)]">Alpha build · v0.1.0</p>
      </div>
    </footer>
  )
}
