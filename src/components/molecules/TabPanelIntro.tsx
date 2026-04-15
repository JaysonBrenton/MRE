/**
 * @fileoverview Consistent heading block for dashboard / analysis tab panels
 */

"use client"

import type { ReactNode } from "react"
import { typography } from "@/lib/typography"

export interface TabPanelIntroProps {
  /** Small uppercase context label above the heading */
  eyebrow?: string
  title: ReactNode
  description: ReactNode
  className?: string
}

export default function TabPanelIntro({
  eyebrow,
  title,
  description,
  className,
}: TabPanelIntroProps) {
  const rootClass = className ? `space-y-1.5 ${className}` : "space-y-1.5"

  return (
    <div className={rootClass}>
      {eyebrow ? <p className={typography.uppercaseSecondary}>{eyebrow}</p> : null}
      <h2 className={typography.h3}>{title}</h2>
      <p className={`max-w-3xl ${typography.bodySecondary}`}>{description}</p>
    </div>
  )
}
