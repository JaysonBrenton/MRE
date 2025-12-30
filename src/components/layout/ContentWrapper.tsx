/**
 * @fileoverview Content wrapper component with max-width constraints
 * 
 * @created 2025-01-27
 * @creator System
 * @lastModified 2025-01-27
 * 
 * @description Wrapper component for page content with consistent max-width
 *              and centering behavior. Ensures proper width constraints in
 *              flex layouts.
 * 
 * @purpose Provides consistent content width constraints across all pages,
 *          preventing width calculation issues in flex containers.
 * 
 * @relatedFiles
 * - src/components/layout/PageContainer.tsx (page container component)
 */

import { ReactNode } from "react"

interface ContentWrapperProps {
  children: ReactNode
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "6xl" | "7xl"
  className?: string
}

const maxWidthClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
}

/**
 * ContentWrapper component
 * 
 * Wraps page content with consistent max-width and centering.
 * Includes:
 * - mx-auto: Centers content horizontally
 * - w-full: Forces full width up to max-width
 * - min-w-0: Allows proper flex shrinking
 * - max-w-{size}: Constrains maximum width
 * 
 * This ensures content doesn't expand beyond readable widths while
 * maintaining proper flexbox behavior.
 */
export default function ContentWrapper({
  children,
  maxWidth = "2xl",
  className = "",
}: ContentWrapperProps) {
  return (
    <section className={`content-wrapper mx-auto w-full min-w-0 ${maxWidthClasses[maxWidth]} ${className}`}>
      {children}
    </section>
  )
}

