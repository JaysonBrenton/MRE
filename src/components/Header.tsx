/**
 * @fileoverview Header component with logo, navigation, and theme toggle
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Reusable header component for authenticated pages
 * 
 * @purpose Provides consistent header with logo, navigation links, and theme toggle
 *          across all authenticated pages. Mobile-responsive with proper touch targets.
 * 
 * @relatedFiles
 * - app/components/ThemeToggle.tsx (theme toggle component)
 * - app/components/AppShell.tsx (where this component is used)
 * - docs/design/mre-mobile-ux-guidelines.md (mobile requirements)
 * - docs/design/mre-dark-theme-guidelines.md (theme tokens)
 */

"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import ThemeToggle from "@/app/components/ThemeToggle"

export default function Header() {
  const pathname = usePathname()

  const navItems = [
    { label: "Overview", href: "/dashboard", exact: true },
    { label: "Events", href: "/events", exact: false },
    { label: "Telemetry", href: "#", exact: false },
    { label: "Setups", href: "#", exact: false },
  ]

  const isActive = (item: typeof navItems[0]) => {
    if (item.exact) {
      return pathname === item.href
    }
    return pathname.startsWith(item.href)
  }

  return (
    <header className="sticky top-0 z-10 border-b border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
          {/* Logo/Brand */}
          <div className="flex items-center">
            <Link
              href="/dashboard"
              className="text-lg font-semibold text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
            >
              MRE
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            {navItems.map((item) => {
              const active = isActive(item)
              return (
                <div key={item.label}>
                  {item.href === "#" ? (
                    <span
                      className={`mobile-button block rounded-md px-3 py-2 text-sm font-medium ${
                        active
                          ? "bg-[var(--token-surface)] text-[var(--token-text-primary)]"
                          : "text-[var(--token-text-muted)]"
                      }`}
                    >
                      {item.label}
                    </span>
                  ) : (
                    <Link
                      href={item.href}
                      className={`mobile-button block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                        active
                          ? "bg-[var(--token-surface)] text-[var(--token-text-primary)]"
                          : "text-[var(--token-text-muted)] hover:text-[var(--token-text-primary)]"
                      } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]`}
                    >
                      {item.label}
                    </Link>
                  )}
                </div>
              )
            })}
          </nav>

          {/* Theme Toggle */}
          <div className="flex items-center sm:ml-4">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  )
}

