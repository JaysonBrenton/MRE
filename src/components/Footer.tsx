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
    <footer className="border-t border-[var(--token-border-muted)] bg-[var(--token-surface)] py-6">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex items-center justify-center gap-2 text-center justify-between">
          <p className="text-sm text-[var(--token-text-muted)]">
            © 2025 My Race Engineer
          </p>
          <p className="text-sm text-[var(--token-text-muted)]">Alpha build · v0.1.0</p>
        </div>
      </div>
    </footer>
  )
}
