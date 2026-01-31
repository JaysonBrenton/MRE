/**
 * @fileoverview Conditional navigation component
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Client component that conditionally renders AdminNav or AuthenticatedNav
 *
 * @purpose Determines which navigation component to show based on the current route.
 *          Admin routes show AdminNav, all other routes show AuthenticatedNav.
 *
 * @relatedFiles
 * - src/components/AuthenticatedNav.tsx (regular user navigation)
 * - src/components/AdminNav.tsx (admin navigation)
 */

"use client"

import { usePathname } from "next/navigation"
import AuthenticatedNav from "@/components/AuthenticatedNav"
import AdminNav from "@/components/AdminNav"

export default function ConditionalNav() {
  const pathname = usePathname()
  const isAdminRoute = pathname.startsWith("/admin")

  return isAdminRoute ? <AdminNav /> : <AuthenticatedNav />
}
