/**
 * @fileoverview Client component for authenticated navigation links
 *
 * Provides top-level navigation with active state styling across Dashboard surfaces.
 */

"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
]

export default function AuthenticatedNavLinks() {
  const pathname = usePathname()

  return (
    <div className="flex flex-col gap-0 sm:flex-row sm:items-center sm:gap-1">
      {NAV_LINKS.map(({ href, label }) => {
        const isActive = pathname === href || pathname.startsWith(`${href}/`)
        return (
          <Link
            key={href}
            href={href}
            className={`mobile-list-item flex items-center px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] sm:px-3 sm:py-2 transition-colors rounded-md ${
              isActive
                ? "text-[var(--token-text-primary)] bg-[var(--token-surface-elevated)]"
                : "text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)]"
            }`}
            aria-current={isActive ? "page" : undefined}
          >
            {label}
          </Link>
        )
      })}
    </div>
  )
}
