import type { CSSProperties, PropsWithChildren, ReactNode } from "react"
import {
  OVERVIEW_GLASS_SURFACE_CLASS,
  OVERVIEW_GLASS_SURFACE_STYLE,
} from "@/components/organisms/event-analysis/overview-glass-surface"
import { typography } from "@/lib/typography"

type DataTableFrameProps = PropsWithChildren<{
  className?: string
}>

type DataPanelSurfaceProps = PropsWithChildren<{
  title?: ReactNode
  subtitle?: ReactNode
  headerControls?: ReactNode
  /** Padding for the main content area. Defaults match existing Event Analysis tables. */
  contentClassName?: string
  className?: string
  style?: CSSProperties
}>

const DEFAULT_CONTENT_CLASS = "px-2 py-2 sm:px-4"

/**
 * Canonical table "frame" inside an Event Analysis glass panel.
 * Keeps borders/radius/clipping consistent across all data-heavy tables.
 */
export function DataTableFrame({ className, children }: DataTableFrameProps) {
  const frameClassName = className
    ? `overflow-hidden rounded-xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] ${className}`
    : "overflow-hidden rounded-xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]"

  return <div className={frameClassName}>{children}</div>
}

export default function DataPanelSurface({
  title,
  subtitle,
  headerControls,
  contentClassName = DEFAULT_CONTENT_CLASS,
  className,
  style,
  children,
}: DataPanelSurfaceProps) {
  const surfaceClass = className
    ? `${OVERVIEW_GLASS_SURFACE_CLASS} ${className}`
    : OVERVIEW_GLASS_SURFACE_CLASS

  return (
    <div className={surfaceClass} style={{ ...OVERVIEW_GLASS_SURFACE_STYLE, ...style }}>
      {(title || subtitle || headerControls) && (
        <div className="border-b border-[var(--token-border-default)] px-4 py-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {title && <h2 className={typography.h4}>{title}</h2>}
              {subtitle && <div className={`mt-1 ${typography.bodySecondary}`}>{subtitle}</div>}
            </div>
            {headerControls && (
              <div className="mt-3 flex flex-wrap items-center gap-3 sm:mt-0">{headerControls}</div>
            )}
          </div>
        </div>
      )}

      <div className={contentClassName}>{children}</div>
    </div>
  )
}
