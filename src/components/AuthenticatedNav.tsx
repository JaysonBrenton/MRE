/**
 * @fileoverview Authenticated navigation component for logged-in users
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Navigation bar for authenticated users with My Event Analysis and Event Search links
 * 
 * @purpose Provides top-level navigation for authenticated Drivers, including My Event Analysis
 *          and Event Search as primary navigation items. Optimized for desktop viewports
 *          with horizontal layout. Uses semantic dark theme tokens.
 * 
 * @relatedFiles
 * - components/LogoutButton.tsx (logout functionality)
 * - docs/design/mre-ux-principles.md (UX patterns)
 * - docs/design/mre-dark-theme-guidelines.md (theme tokens)
 */

import Link from "next/link"
import LogoutButton from "./LogoutButton"

export default function AuthenticatedNav() {
  return (
    <nav className="w-full bg-[var(--token-surface)]">
      <div className="flex items-center justify-between gap-4 p-4 border-b border-[var(--token-border-default)] h-[60px]">
        {/* Logo/Brand */}
        <div className="flex items-center">
            <Link
              href="/welcome"
              className="text-lg font-semibold text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
            >
              My Race Engineer
            </Link>
          </div>

          {/* Navigation Links */}
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-base font-medium text-[var(--token-text-primary)] hover:text-[var(--token-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)] rounded"
            >
              My Event Analysis
            </Link>
            <LogoutButton />
          </div>
      </div>
    </nav>
  )
}
