/**
 * @fileoverview Admin route group layout
 *
 * @created 2025-01-29
 * @creator System
 * @lastModified 2025-01-29
 *
 * @description Shared layout for all admin pages providing AdminNav navigation
 *
 * @purpose Provides consistent admin navigation bar across all admin routes,
 *          including links to Dashboard, Users, Events, Tracks, Ingestion,
 *          Audit Logs, Health Checks, and Logs.
 *
 * @relatedFiles
 * - src/components/AdminNav.tsx (admin navigation component)
 * - src/app/(authenticated)/layout.tsx (parent authenticated layout)
 */

import AdminNav from "@/components/AdminNav"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AdminNav />
      {children}
    </>
  )
}
