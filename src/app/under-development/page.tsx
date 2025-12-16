/**
 * @fileoverview Under development page
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Placeholder page for features not yet implemented in Alpha
 * 
 * @purpose This page displays a message indicating that a feature is under
 *          development. Per Alpha scope requirements, features that are out
 *          of scope must redirect to this page. The page uses dark theme tokens
 *          and mobile-first layout as required by the architecture guidelines.
 * 
 * @relatedFiles
 * - docs/specs/mre-alpha-feature-scope.md (Alpha feature requirements)
 * - docs/design/mre-dark-theme-guidelines.md (theme guidelines)
 */

export default function UnderDevelopmentPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--token-surface)] px-4 py-8">
      <div className="w-full max-w-2xl text-center">
        <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--token-text-primary)]">
          This feature is under development
        </h1>
      </div>
    </div>
  )
}

