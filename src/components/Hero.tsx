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
 *          hero image, and call-to-action buttons. Follows mobile-first design with
 *          right-aligned image on desktop, stacked on mobile.
 * 
 * @relatedFiles
 * - README.md (section 13.3 - Hero Message, section 13.4 - Hero Image Design)
 * - docs/design/mre-dark-theme-guidelines.md
 * - docs/design/mre-mobile-ux-guidelines.md
 */

export default function Hero() {
  return (
    <section className="w-full bg-[var(--token-surface)] py-12 sm:py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-[var(--token-text-primary)] sm:text-4xl lg:text-5xl">
            Drive faster, think clearer.
          </h1>
          <p className="text-lg leading-relaxed text-[var(--token-text-secondary)] sm:text-xl">
            Let MRE reveal where you're gaining and losing time, lap-by-lap.
          </p>
        </div>
      </div>
    </section>
  )
}

