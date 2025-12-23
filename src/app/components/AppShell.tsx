/**
 * @fileoverview Application shell component
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Reusable application shell with sidebar navigation and top bar
 * 
 * @purpose Provides consistent layout structure for all pages using AppShell.
 *          Includes sidebar navigation, top bar with theme toggle, and main content area.
 * 
 * @relatedFiles
 * - app/components/ThemeToggle.tsx (theme toggle component)
 * - app/globals.css (theme tokens)
 */

"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import ThemeToggle from "./ThemeToggle"

interface AppShellProps {
  children: React.ReactNode
}

export default function AppShell({ children }: AppShellProps) {
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
    <div className="flex min-h-screen bg-[var(--token-surface)]">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-[220px] border-r border-[var(--token-border-muted)] bg-[var(--token-surface)]">
        <div className="flex h-full flex-col">
          {/* Logo/Brand */}
          <div className="border-b border-[var(--token-border-muted)] p-4">
            <h2 className="text-lg font-semibold text-[var(--token-text-primary)]">MRE</h2>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4">
            <ul className="space-y-2">
              {navItems.map((item) => {
                const active = isActive(item)
                return (
                  <li key={item.label}>
                    {item.href === "#" ? (
                      <span
                        className={`block rounded-md px-3 py-2 text-sm font-medium ${
                          active
                            ? "bg-[var(--token-surface-elevated)] text-[var(--token-text-primary)]"
                            : "text-[var(--token-text-muted)]"
                        }`}
                      >
                        {item.label}
                      </span>
                    ) : (
                      <Link
                        href={item.href}
                        className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                          active
                            ? "bg-[var(--token-surface-elevated)] text-[var(--token-text-primary)]"
                            : "text-[var(--token-text-muted)] hover:text-[var(--token-text-primary)]"
                        }`}
                      >
                        {item.label}
                      </Link>
                    )}
                  </li>
                )
              })}
            </ul>
          </nav>

          {/* Footer */}
          <div className="border-t border-[var(--token-border-muted)] p-4">
            <p className="text-xs text-[var(--token-text-muted)]">Alpha</p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col pl-[220px]">
        {/* Top Bar */}
        <header className="sticky top-0 z-10 border-b border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)] px-4 py-3">
          <div className="flex justify-end">
            <ThemeToggle />
          </div>
        </header>

        {/* Page Content */}
        <main id="main-content" className="flex-1" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  )
}
