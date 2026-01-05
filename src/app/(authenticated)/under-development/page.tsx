/**
 * @fileoverview Under development page
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Placeholder page for features not yet implemented in version 0.1.1
 *
 * @purpose This page displays a message indicating that a feature is under
 *          development. Per version 0.1.1 scope requirements, features that are out
 *          of scope must redirect to this page. The page uses dark theme tokens
 *          and mobile-first layout as required by the architecture guidelines.
 *
 * @relatedFiles
 * - src/app/(authenticated)/layout.tsx (shared layout wrapper)
 * - docs/specs/mre-v0.1-feature-scope.md (Version 0.1.1 feature requirements)
 * - docs/design/mre-dark-theme-guidelines.md (theme guidelines)
 */

import Breadcrumbs from "@/components/Breadcrumbs"

export default function UnderDevelopmentPage() {
  return (
    <section className="content-wrapper mx-auto w-full min-w-0 max-w-6xl flex-shrink-0">
      <Breadcrumbs
        items={[{ label: "Home", href: "/dashboard" }, { label: "Under Development" }]}
      />
      <div className="text-center">
        <h1 className="text-3xl font-semibold text-[var(--token-text-primary)]">
          We&rsquo;re still building this feature, the pit crew is working on it!
        </h1>
      </div>
    </section>
  )
}
