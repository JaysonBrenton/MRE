/**
 * @fileoverview Hero section component for landing page
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Hero section with exact text from README section 13.3, image placeholder,
 *              and CTA buttons
 *
 * @purpose Displays the hero message, placeholder for future Stable Diffusion-generated
 *          hero image, and call-to-action buttons. Optimized for desktop viewports.
 *
 * @relatedFiles
 * - README.md (section 13.3 - Hero Message, section 13.4 - Hero Image Design)
 * - docs/design/mre-dark-theme-guidelines.md
 */

export default function Hero() {
  return (
    <section className="w-full bg-[var(--token-surface)] py-24">
      <div className="mx-auto w-full max-w-7xl px-6">
        <div className="flex flex-col gap-4">
          <h1 className="text-5xl font-semibold leading-tight tracking-tight text-[var(--token-text-primary)]">
            Drive faster, think clearer.
          </h1>
          <p className="text-xl leading-relaxed text-[var(--token-text-secondary)]">
            Let MRE reveal where you&apos;re gaining and losing time, lap-by-lap.
          </p>
          <p className="mt-2 text-lg text-[var(--token-text-muted)]">
            Import race data from LiveRC and analyze performance with powerful analytics and driver
            matching.
          </p>
        </div>
      </div>
    </section>
  )
}
