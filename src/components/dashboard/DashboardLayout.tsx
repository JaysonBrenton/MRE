/**
 * @fileoverview Dashboard layout wrapper with sidebar
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Client-side layout wrapper that manages sidebar state and layout
 * 
 * @purpose Wraps dashboard content with collapsible sidebar navigation.
 *          Optimized for desktop viewports. Used by the authenticated route group
 *          layout to provide consistent sidebar across all authenticated pages.
 * 
 * @relatedFiles
 * - src/app/(authenticated)/layout.tsx (route group layout using this component)
 * - src/components/dashboard/DashboardSidebar.tsx (sidebar component)
 */

"use client"

import DashboardSidebar from "@/components/dashboard/DashboardSidebar"

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex w-full bg-[var(--token-surface)] min-h-screen">
      {/* Sidebar */}
      <DashboardSidebar />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {children}
      </div>
    </div>
  )
}

