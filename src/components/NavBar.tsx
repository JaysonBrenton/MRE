/**
 * @fileoverview Navigation bar component for landing page
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Full navigation bar with all required items per README section 13.1
 * 
 * @purpose Provides navigation for the landing page with all items from the product vision.
 *          Login/Register route to real pages, all other items route to /under-development
 *          as required by README section 13.2.
 * 
 * @relatedFiles
 * - README.md (section 13.1 - Landing Page Navigation)
 * - docs/specs/mre-under-development-page.md
 * - docs/design/mre-mobile-ux-guidelines.md
 */

import Link from "next/link"

export default function NavBar() {
  const navItems = [
    { label: "Home", href: "/under-development" },
    { label: "Telemetry", href: "/under-development" },
    { label: "Analytics", href: "/under-development" },
    { label: "LiveRC Integration", href: "/under-development" },
    { label: "Setup Sheets", href: "/under-development" },
    { label: "AI Coach", href: "/under-development" },
    { label: "Pricing", href: "/under-development" },
    { label: "Blog", href: "/under-development" },
  ]

  return (
    <nav className="w-full border-b border-[var(--token-border-default)] bg-[var(--token-surface)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          {/* Logo/Brand */}
          <div className="flex items-center py-4">
            <Link
              href="/"
              className="text-lg font-semibold text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
            >
              My Race Engineer
            </Link>
          </div>

          {/* Navigation Items */}
          <div className="flex flex-col gap-0 sm:flex-row sm:items-center sm:gap-1">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="mobile-list-item flex items-center px-4 text-sm font-medium text-[var(--token-text-secondary)] transition-colors hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] sm:px-3"
              >
                {item.label}
              </Link>
            ))}
            
            {/* Login / Register */}
            <div className="flex flex-col gap-0 border-t border-[var(--token-border-muted)] py-2 sm:flex-row sm:border-t-0 sm:gap-2 sm:py-0 sm:pl-4">
              <Link
                href="/login"
                className="mobile-button flex items-center justify-center rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-4 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] sm:px-5"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="mobile-button mt-2 flex items-center justify-center rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-4 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] sm:mt-0 sm:px-5"
              >
                Register
              </Link>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}

