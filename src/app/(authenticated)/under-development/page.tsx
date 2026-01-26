/**
 * @fileoverview Under development page
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2026-01-27
 *
 * @description Placeholder page for features not yet implemented in version 0.1.1
 *
 * @purpose This page displays a message indicating that a feature is under
 *          development. Per version 0.1.1 scope requirements, features that are out
 *          of scope must redirect to this page. The page uses dark theme tokens
 *          and mobile-first layout as required by the architecture guidelines.
 *          Now includes feature-specific descriptions when available.
 *
 * @relatedFiles
 * - src/app/(authenticated)/layout.tsx (shared layout wrapper)
 * - src/lib/feature-descriptions.ts (feature description mappings)
 * - docs/specs/mre-v0.1-feature-scope.md (Version 0.1.1 feature requirements)
 * - docs/design/mre-dark-theme-guidelines.md (theme guidelines)
 */

"use client"

import { useSearchParams } from "next/navigation"
import Breadcrumbs from "@/components/Breadcrumbs"
import { getFeatureDescription } from "@/lib/feature-descriptions"

export default function UnderDevelopmentPage() {
  const searchParams = useSearchParams()
  const fromRoute = searchParams.get("from")
  const featureInfo = getFeatureDescription(fromRoute)

  return (
    <section className="content-wrapper mx-auto w-full min-w-0 max-w-6xl flex-shrink-0">
      <Breadcrumbs
        items={[{ label: "My Event Analysis", href: "/dashboard" }, { label: "Under Development" }]}
      />
      <div className="w-full min-w-0 flex flex-col items-center text-center space-y-6">
        <h1 className="text-3xl font-semibold text-[var(--token-text-primary)]">
          We&rsquo;re still building this feature, the pit crew is working on it!
        </h1>
        {featureInfo && (
          <div className="mt-8 w-full min-w-[280px] max-w-2xl rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
            <h2 className="text-xl font-semibold text-[var(--token-text-primary)] mb-3">
              {featureInfo.name}
            </h2>
            <p className="text-[var(--token-text-secondary)]">
              This feature will provide: {featureInfo.description}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
