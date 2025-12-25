/**
 * @fileoverview Authenticated navigation component for logged-in users
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Navigation bar for authenticated users with Dashboard and Event Search links
 * 
 * @purpose Provides top-level navigation for authenticated Drivers, including Dashboard
 *          and Event Search as primary navigation items. Follows mobile-first design with
 *          single-column layout on mobile and horizontal layout on desktop. Meets 44px
 *          touch target requirements and uses semantic dark theme tokens.
 * 
 * @relatedFiles
 * - components/LogoutButton.tsx (logout functionality)
 * - docs/design/mre-ux-principles.md (UX patterns)
 * - docs/design/mre-mobile-ux-guidelines.md (mobile requirements)
 * - docs/design/mre-dark-theme-guidelines.md (theme tokens)
 */

import Link from "next/link"
import LogoutButton from "./LogoutButton"
import AuthenticatedNavLinks from "./AuthenticatedNavLinks"

export default function AuthenticatedNav() {
  return (
    <nav className="w-full border-b border-[var(--token-border-default)] bg-[var(--token-surface)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          {/* Logo/Brand */}
          <div className="flex items-center py-4">
            <Link
              href="/dashboard"
              className="text-lg font-semibold text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
            >
              My Race Engineer
            </Link>
          </div>

          {/* Navigation Items */}
          <div className="flex flex-col gap-0 sm:flex-row sm:items-center sm:gap-2">
            <AuthenticatedNavLinks />
            <div className="flex flex-col gap-0 border-t border-[var(--token-border-muted)] py-2 sm:flex-row sm:border-t-0 sm:py-0 sm:pl-4">
              <LogoutButton />
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
