/**
 * @fileoverview Breadcrumb navigation component
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Breadcrumb navigation for providing context and back navigation
 *
 * @purpose Provides consistent breadcrumb navigation across the application
 *
 * @relatedFiles
 * - src/app/(authenticated)/dashboard/page.tsx
 * - src/app/(authenticated)/event-search/page.tsx
 * - src/app/(authenticated)/events/page.tsx
 * - src/app/(authenticated)/dashboard/my-event/page.tsx
 */

import Link from "next/link"

export interface BreadcrumbItem {
  label: string
  href?: string
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[]
}

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex flex-wrap items-center gap-2 text-sm text-[var(--token-text-secondary)]">
        {items.map((item, index) => {
          const isLast = index === items.length - 1

          return (
            <li key={index} className="flex items-center gap-2">
              {index > 0 && (
                <svg
                  className="h-4 w-4 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              )}
              {isLast || !item.href ? (
                <span
                  className={isLast ? "text-[var(--token-text-primary)] font-medium" : ""}
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] rounded"
                >
                  {item.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
