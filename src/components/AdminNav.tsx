/**
 * @fileoverview Admin navigation component
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Navigation bar for admin console with links to admin features
 *
 * @purpose Provides navigation for administrators to access different admin features.
 *          Optimized for desktop viewports with horizontal layout.
 *
 * @relatedFiles
 * - components/LogoutButton.tsx (logout functionality)
 * - docs/design/mre-ux-principles.md (UX patterns)
 */

"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import LogoutButton from "./LogoutButton"

const ADMIN_NAV_LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/tracks", label: "Tracks" },
  { href: "/admin/ingestion", label: "Ingestion" },
  { href: "/admin/audit", label: "Audit Logs" },
  { href: "/admin/health", label: "Health Checks" },
  { href: "/admin/logs", label: "Logs" },
]

export default function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="w-full border-b border-[var(--token-border-default)] bg-[var(--token-surface)]">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex items-center justify-between gap-4">
          {/* Logo/Brand */}
          <div className="flex items-center py-4">
            <Link
              href="/admin"
              className="text-lg font-semibold text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
            >
              MRE Admin
            </Link>
          </div>

          {/* Navigation Items */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {ADMIN_NAV_LINKS.map(({ href, label }) => {
                const isActive = pathname === href || pathname.startsWith(`${href}/`)
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center px-3 py-2 text-sm font-medium transition-colors rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] ${
                      isActive
                        ? "text-[var(--token-text-primary)] bg-[var(--token-surface-elevated)]"
                        : "text-[var(--token-text-muted)] hover:text-[var(--token-text-primary)]"
                    }`}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {label}
                  </Link>
                )
              })}
            </div>
            <div className="flex items-center pl-4">
              <LogoutButton />
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
