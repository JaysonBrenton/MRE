/**
 * @fileoverview Chart section wrapper component
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Wrapper component for chart and pagination
 *
 * @purpose Provides consistent layout and spacing for chart components.
 *
 * @relatedFiles
 * - src/components/event-analysis/OverviewTab.tsx (uses this)
 */

"use client"

import { ReactNode } from "react"

export interface ChartSectionProps {
  children: ReactNode
  className?: string
}

export default function ChartSection({ children, className = "" }: ChartSectionProps) {
  return <div className={`w-full ${className}`}>{children}</div>
}
