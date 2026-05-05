"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import Tooltip from "@/components/molecules/Tooltip"
import { GUIDE_ITEMS } from "./navigationRailConfig"

export interface NavigationRailGuidesSectionProps {
  isNavCollapsed: boolean
  isGuidesExpanded: boolean
  onToggleGuidesExpanded: () => void
  isGuidesMenuExpanded: boolean
  onToggleGuidesMenuExpanded: () => void
}

function CollapsedGuidesMenu({
  isGuidesMenuExpanded,
  onToggleGuidesMenuExpanded,
}: {
  isGuidesMenuExpanded: boolean
  onToggleGuidesMenuExpanded: () => void
}) {
  const pathname = usePathname()
  const guidesIndexActive = pathname === "/guides" || pathname.startsWith("/guides/")
  const isGuideActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  const guidesIcon = (
    <svg
      className={`h-5 w-5 transition-transform motion-reduce:transition-none ${guidesIndexActive ? "text-[var(--token-accent)]" : "text-[var(--token-text-secondary)]"} ${isGuidesMenuExpanded ? "rotate-90" : ""}`}
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )

  return (
    <div>
      <Tooltip text="Guides" position="right">
        <button
          type="button"
          onClick={onToggleGuidesMenuExpanded}
          className={`group flex w-full items-center justify-center rounded-lg px-3 py-2 transition motion-reduce:transition-none hover:bg-[var(--token-surface-raised)]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-accent)] ${
            isGuidesMenuExpanded ? "bg-[var(--token-surface-raised)]/50" : ""
          }`}
          aria-label="Guides"
          aria-expanded={isGuidesMenuExpanded}
        >
          {guidesIcon}
        </button>
      </Tooltip>
      {isGuidesMenuExpanded && (
        <div className="mt-1 space-y-1">
          {GUIDE_ITEMS.map((guide) => {
            const active = isGuideActive(guide.href)
            return (
              <Tooltip key={guide.href} text={guide.label} position="right">
                <Link
                  href={guide.href}
                  className={`group flex items-center justify-center rounded-lg px-3 py-2 transition hover:bg-[var(--token-surface-raised)]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-accent)] ${
                    active ? "bg-[var(--token-surface-raised)]/30" : ""
                  }`}
                  aria-current={active ? "page" : undefined}
                  aria-label={guide.label}
                >
                  {guide.icon(active)}
                </Link>
              </Tooltip>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function NavigationRailGuidesSection({
  isNavCollapsed,
  isGuidesExpanded,
  onToggleGuidesExpanded,
  isGuidesMenuExpanded,
  onToggleGuidesMenuExpanded,
}: NavigationRailGuidesSectionProps) {
  const pathname = usePathname()

  const isGuideActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  return (
    <div className="border-t border-[var(--token-border-muted)] px-2 py-4">
      {isNavCollapsed ? (
        <div className="space-y-1">
          <CollapsedGuidesMenu
            isGuidesMenuExpanded={isGuidesMenuExpanded}
            onToggleGuidesMenuExpanded={onToggleGuidesMenuExpanded}
          />
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={onToggleGuidesExpanded}
            className="group flex w-full items-center justify-between rounded-lg px-3 py-2 transition motion-reduce:transition-none hover:bg-[var(--token-surface-raised)]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-accent)]"
            aria-label="User Guides"
            aria-expanded={isGuidesExpanded}
          >
            <div className="flex items-center gap-3">
              <svg
                className="h-5 w-5 text-[var(--token-text-secondary)]"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="text-sm font-medium text-[var(--token-text-secondary)] transition-opacity duration-150 ease-out motion-reduce:transition-none">
                User Guides
              </span>
            </div>
            <svg
              className={`h-4 w-4 text-[var(--token-text-muted)] transition-transform motion-reduce:transition-none ${isGuidesExpanded ? "rotate-180" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="m6 9 6 6 6-6"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          {isGuidesExpanded && (
            <div className="mt-1 space-y-1 pl-8">
              {GUIDE_ITEMS.map((guide) => {
                const active = isGuideActive(guide.href)
                return (
                  <Link
                    key={guide.href}
                    href={guide.href}
                    className={`block rounded-lg px-3 py-2 text-sm transition hover:bg-[var(--token-surface-raised)]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-accent)] ${
                      active
                        ? "font-medium text-[var(--token-text-primary)]"
                        : "text-[var(--token-text-secondary)]"
                    }`}
                    aria-current={active ? "page" : undefined}
                  >
                    {guide.label}
                  </Link>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
