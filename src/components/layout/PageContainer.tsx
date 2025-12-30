/**
 * @fileoverview Page container component with proper flexbox constraints
 * 
 * @created 2025-01-27
 * @creator System
 * @lastModified 2025-01-27
 * 
 * @description Reusable page container that ensures proper width constraints
 *              in flex layouts. Prevents flexbox shrink issues.
 * 
 * @purpose Provides consistent page layout structure across all pages,
 *          preventing width collapse issues in flex column containers.
 * 
 * @relatedFiles
 * - src/components/layout/ContentWrapper.tsx (content wrapper component)
 */

import { ReactNode } from "react"

interface PageContainerProps {
  children: ReactNode
  id?: string
  className?: string
  tabIndex?: number
}

/**
 * PageContainer component
 * 
 * Ensures proper flexbox behavior in flex column layouts by including:
 * - w-full: Forces full width
 * - min-w-0: Allows proper flex shrinking of children
 * - flex-1: Takes available vertical space
 * 
 * This prevents the common flexbox issue where containers collapse to
 * minimal width when used in flex column layouts.
 */
export default function PageContainer({
  children,
  id = "main-content",
  className = "",
  tabIndex = -1,
}: PageContainerProps) {
  return (
    <main
      id={id}
      className={`page-container flex-1 w-full min-w-0 px-6 py-12 ${className}`}
      tabIndex={tabIndex}
    >
      {children}
    </main>
  )
}

