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
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex items-center justify-between gap-4">
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
          <div className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center px-3 text-sm font-medium text-[var(--token-text-secondary)] transition-colors hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
              >
                {item.label}
              </Link>
            ))}

            {/* Login / Register */}
            <div className="flex items-center gap-2 pl-4">
              <Link
                href="/login"
                className="flex items-center justify-center rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-5 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface-raised)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="flex items-center justify-center rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-5 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface-raised)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
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
