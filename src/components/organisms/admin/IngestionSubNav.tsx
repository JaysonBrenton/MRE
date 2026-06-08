/**
 * @fileoverview Sub-navigation for admin ingestion pages (Controls | Settings)
 */

"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const INGESTION_TABS = [
  { href: "/admin/ingestion", label: "Controls", exact: true },
  { href: "/admin/ingestion/settings", label: "Settings", exact: false },
]

export default function IngestionSubNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Ingestion sections"
      className="flex gap-2 border-b border-[var(--token-border-default)] pb-3"
    >
      {INGESTION_TABS.map(({ href, label, exact }) => {
        const isActive = exact ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--token-interactive-focus-ring)] ${
              isActive
                ? "bg-[var(--token-surface-elevated)] text-[var(--token-text-primary)]"
                : "text-[var(--token-text-muted)] hover:text-[var(--token-text-primary)]"
            }`}
            aria-current={isActive ? "page" : undefined}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
