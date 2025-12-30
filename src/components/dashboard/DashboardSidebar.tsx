/**
 * @fileoverview Dashboard sidebar component with collapsible functionality
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Collapsible sidebar for dashboard page with navigation links
 * 
 * @purpose Provides navigation sidebar for dashboard with links to event search and events page.
 *          Sidebar is collapsible and optimized for desktop viewports.
 *          Follows dark theme guidelines.
 * 
 * @relatedFiles
 * - src/app/dashboard/page.tsx (dashboard page)
 * - docs/design/mre-dark-theme-guidelines.md (theme tokens)
 * - docs/design/navigation-patterns.md (sidebar implementation guidelines)
 */

"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

export default function DashboardSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const pathname = usePathname()
  const collapseButtonRef = useRef<HTMLButtonElement>(null)

  // Blur any focused elements in footer section after state change to prevent yellow flash during expansion
  useEffect(() => {
    const footerSection = collapseButtonRef.current?.closest('div[class*="mt-auto"]')
    if (footerSection) {
      const focusedElement = footerSection.querySelector(':focus') as HTMLElement
      if (focusedElement) {
        requestAnimationFrame(() => {
          focusedElement.blur()
        })
      }
    }
  }, [isCollapsed])

  // Helper function to check if a route is active
  const isActive = (href: string) => {
    if (href === "/event-search") {
      return pathname === "/event-search"
    }
    if (href === "/events") {
      return pathname === "/events" || pathname?.startsWith("/events/")
    }
    return pathname === href || pathname?.startsWith(`${href}/`)
  }

  // Helper function to render a nav link
  const NavLink = ({ href, icon, label, title }: { href: string; icon: React.ReactNode; label: string; title?: string }) => {
    const active = isActive(href)
    return (
      <Link
        href={href}
        className={`
          flex items-center ${isCollapsed ? "justify-center" : "gap-4"} p-3 rounded-md
          text-[var(--token-text-primary)]
          hover:bg-[var(--token-surface)]
          outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)]
          transition-colors
          ${active ? "bg-[var(--token-surface)]" : ""}
        `}
        title={isCollapsed ? (title || label) : undefined}
      >
        <span className={active ? "text-[var(--token-accent)]" : ""}>
          {icon}
        </span>
        {!isCollapsed && (
          <span className={`text-sm ${active ? "font-semibold" : "font-medium"}`}>
            {label}
          </span>
        )}
      </Link>
    )
  }

  return (
    <aside
      data-sidebar
      className={`
        relative h-full
        bg-[var(--token-surface-elevated)]
        border-r border-[var(--token-border-default)]
        transition-all duration-300 ease-in-out
        ${isCollapsed ? "w-16" : "w-64"}
        flex flex-col
      `}
      aria-label="Dashboard navigation"
    >
      {/* Header */}
      <div className={`flex items-center ${isCollapsed ? "justify-center" : "justify-between"} p-4 border-b border-[var(--token-border-default)] h-[60px]`}>
        {isCollapsed ? (
          <svg
            className="w-6 h-6 text-[var(--token-text-primary)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        ) : (
          <h2 className="text-lg font-semibold text-[var(--token-text-primary)]">
            Navigation
          </h2>
        )}
      </div>

      {/* Main Navigation (scrollable) */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {/* Group 1: Events */}
        <NavLink
          href="/event-search"
          label="Event Search"
          icon={
            <svg
              className="w-5 h-5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          }
        />
        <NavLink
          href="/dashboard/my-event"
          label="My Event"
          icon={
            <svg
              className="w-5 h-5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        />
        <NavLink
          href="/events"
          label="All Events"
          icon={
            <svg
              className="w-5 h-5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          }
        />

        {/* Divider */}
        <div className="border-t border-[var(--token-border-default)] my-2" />

        {/* Group 2: Personal */}
        <NavLink
          href="/dashboard/my-engineer"
          label="My Engineer"
          icon={
            <svg
              className="w-5 h-5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
        <NavLink
          href="/dashboard/my-telemetry"
          label="My Telemetry"
          icon={
            <svg
              className="w-5 h-5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />

        {/* Divider */}
        <div className="border-t border-[var(--token-border-default)] my-2" />

        {/* Group 3: Settings */}
        <NavLink
          href="/dashboard/data-sources"
          label="Data Sources"
          icon={
            <svg
              className="w-5 h-5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
          }
        />
      </nav>

      {/* Footer Section (sticky) */}
      <div className="mt-auto border-t border-[var(--token-border-default)] p-4 space-y-1">
        <NavLink
          href="/dashboard/profile"
          label="Profile"
          icon={
            <svg
              className="w-5 h-5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          }
        />

        {/* Collapse Button */}
        <button
          ref={collapseButtonRef}
          onClick={() => {
            setIsCollapsed(!isCollapsed)
          }}
          className={`
            w-full flex items-center ${isCollapsed ? "justify-center" : "gap-4"} p-3 rounded-md
            text-[var(--token-text-secondary)]
            hover:bg-[var(--token-surface)]
            hover:text-[var(--token-text-primary)]
            outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)]
            transition-colors
          `}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!isCollapsed}
        >
          <svg
            className={`w-5 h-5 transition-transform ${isCollapsed ? "" : "rotate-180"}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {!isCollapsed && (
            <span className="text-sm font-medium">Collapse</span>
          )}
        </button>
      </div>
    </aside>
  )
}

