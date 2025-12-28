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
import Footer from "@/components/Footer"
import LogoutButton from "@/components/LogoutButton"

interface AppShellProps {
  children: React.ReactNode
  session: {
    user: {
      name: string
    }
  }
}

export default function AppShell({ children, session }: AppShellProps) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-[var(--token-surface)]">
      <header className="border-b border-[var(--token-border-muted)] bg-[var(--token-surface)]">
        <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/welcome"
            className="text-lg font-semibold text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
          >
            My Race Engineer
          </Link>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <p className="text-sm text-[var(--token-text-secondary)]">
              Signed in as {session.user.name}
            </p>
            <LogoutButton variant="compact" />
          </div>
        </div>
      </header>
      <main id="main-content" className="flex-1 w-full min-w-0" tabIndex={-1}>
        <div className="mx-auto w-full min-w-0 max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  )
}
