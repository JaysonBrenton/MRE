"use client"

import { ExternalLink, Facebook, Globe, Mail, Map as MapIcon, MapPin, Phone } from "lucide-react"
import { MapSearchAddressLink } from "@/components/molecules/MapSearchAddressLink"
import {
  EVENT_DETAILS_EMPTY_STATE_CLASS,
  EVENT_DETAILS_VENUE_SECTION_WELL_CLASS,
} from "./overview-glass-surface"
import { typography } from "@/lib/typography"

const ACTION_BTN_CLASS =
  "inline-flex items-center gap-1.5 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-raised)]/80 px-2.5 py-1.5 text-xs font-medium text-[var(--token-text-primary)] transition-colors hover:border-[var(--token-accent)]/45 hover:bg-[var(--token-surface-elevated)] hover:text-[var(--token-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-accent)]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--token-surface)]"

const CONTACT_LINK_CLASS =
  "min-w-0 break-words text-[var(--token-accent)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-accent)]/35 focus-visible:rounded-sm"

/** Typography + hover/focus like {@link MapSearchAddressLink} full-address anchor (minimal overview glance column). */
const CONTACT_GLANCE_LINK_CLASS =
  "min-w-0 max-w-full break-words rounded-sm text-[var(--token-text-primary)] text-sm font-normal leading-snug no-underline decoration-[var(--token-accent)]/50 underline-offset-2 transition-colors hover:text-[var(--token-accent)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--token-accent)]/50"

export type OverviewVenueDetailPanelProps = {
  /** Stable prefix for section heading ids (e.g. `event-host`, `host-track`). */
  idPrefix: string
  variant: "host" | "track"
  primaryTitle: string | null
  /** LiveRC track dashboard URL — enables linked primary heading when set. */
  primaryDashboardUrl?: string | null
  address?: string | null
  /** Track / club name line inside Location (below the section title). */
  locationTrackName?: string | null
  /** When false, `locationTrackName` is not shown (e.g. duplicates first address line). */
  showLocationTrackName?: boolean
  phone?: string | null
  website?: string | null
  email?: string | null
  facebookUrl?: string | null
}

/**
 * Shared Location / Contact / Actions layout for Event details Host and Track tabs.
 */
export function OverviewVenueDetailPanel({
  idPrefix,
  variant,
  primaryTitle,
  primaryDashboardUrl,
  address = null,
  locationTrackName = null,
  showLocationTrackName = false,
  phone = null,
  website = null,
  email = null,
  facebookUrl = null,
}: OverviewVenueDetailPanelProps) {
  const hasAddress = !!(address && address.trim())
  const hasPhone = !!(phone && phone.trim())
  const hasWebsite = !!(website && website.trim())
  const hasEmail = !!(email && email.trim())
  const hasFacebook = !!(facebookUrl && facebookUrl.trim())
  const hasContact = hasPhone || hasWebsite || hasEmail || hasFacebook

  const websiteHref = hasWebsite
    ? website!.startsWith("http")
      ? website!
      : `https://${website}`
    : null
  const mapsHref = hasAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address!.trim())}`
    : null

  const hasActions = !!(mapsHref || websiteHref || hasEmail || hasFacebook)

  const trackLine =
    showLocationTrackName && locationTrackName?.trim() ? locationTrackName.trim() : null
  const showLocationSection = !!(trackLine || hasAddress)

  const emailActionLabel = variant === "host" ? "Email host" : "Email club"
  const actionsAriaLabel = variant === "host" ? "Host quick links" : "Track quick links"

  const hasHeading = Boolean(primaryTitle?.trim())
  const hasAnyContent = hasHeading || showLocationSection || hasContact || hasActions

  if (!hasAnyContent) {
    return (
      <p className={EVENT_DETAILS_EMPTY_STATE_CLASS} role="status">
        No venue details on file for this event.
      </p>
    )
  }

  return (
    <div className="min-w-0 space-y-4">
      {primaryTitle ? (
        <header className="border-b border-[var(--token-border-muted)] pb-4">
          <h4 className={`${typography.h4} tracking-tight text-balance`}>
            {primaryDashboardUrl ? (
              <a
                href={primaryDashboardUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-w-0 max-w-full flex-wrap items-baseline gap-1.5 break-words rounded-sm text-[var(--token-text-primary)] no-underline transition-colors hover:text-[var(--token-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-accent)]/35"
              >
                <span>{primaryTitle}</span>
                <ExternalLink
                  className="h-4 w-4 shrink-0 text-[var(--token-text-muted)]"
                  aria-hidden
                />
                <span className="sr-only"> (opens in a new tab on LiveRC)</span>
              </a>
            ) : (
              <span className="text-[var(--token-text-primary)]">{primaryTitle}</span>
            )}
          </h4>
        </header>
      ) : null}

      {showLocationSection || hasContact ? (
        <div className="grid min-w-0 grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2 lg:gap-x-10 lg:gap-y-4 lg:items-start">
          {showLocationSection ? (
            <section
              className={`min-w-0 ${EVENT_DETAILS_VENUE_SECTION_WELL_CLASS}`}
              aria-labelledby={`${idPrefix}-location-title`}
            >
              <h5
                id={`${idPrefix}-location-title`}
                className={`${typography.overviewEyebrow} mb-2`}
              >
                Location
              </h5>
              <div className="min-w-0 space-y-3">
                {trackLine ? (
                  <div className="flex min-w-0 items-start gap-2">
                    <MapPin
                      className="mt-0.5 h-4 w-4 shrink-0 text-[var(--token-text-muted)]"
                      aria-hidden
                    />
                    <span className="font-medium text-[var(--token-text-primary)]">
                      {trackLine}
                    </span>
                  </div>
                ) : null}
                {hasAddress ? (
                  <div className="flex min-w-0 items-start gap-2">
                    <MapPin
                      className="mt-0.5 h-4 w-4 shrink-0 text-[var(--token-text-muted)]"
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <MapSearchAddressLink address={address!.trim()} showMapLink={false} />
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {hasContact ? (
            <section
              className={`min-w-0 ${EVENT_DETAILS_VENUE_SECTION_WELL_CLASS}`}
              aria-labelledby={`${idPrefix}-contact-title`}
            >
              <h5 id={`${idPrefix}-contact-title`} className={`${typography.overviewEyebrow} mb-2`}>
                Contact
              </h5>
              <ul className="m-0 list-none space-y-2.5 p-0">
                {hasPhone ? (
                  <li className="flex min-w-0 items-start gap-2">
                    <Phone
                      className="mt-0.5 h-4 w-4 shrink-0 text-[var(--token-text-muted)]"
                      aria-hidden
                    />
                    <a href={`tel:${phone!.replace(/\s/g, "")}`} className={CONTACT_LINK_CLASS}>
                      {phone}
                    </a>
                  </li>
                ) : null}
                {hasWebsite && websiteHref ? (
                  <li className="flex min-w-0 items-start gap-2">
                    <Globe
                      className="mt-0.5 h-4 w-4 shrink-0 text-[var(--token-text-muted)]"
                      aria-hidden
                    />
                    <a
                      href={websiteHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={CONTACT_LINK_CLASS}
                    >
                      {website}
                    </a>
                  </li>
                ) : null}
                {hasEmail ? (
                  <li className="flex min-w-0 items-start gap-2">
                    <Mail
                      className="mt-0.5 h-4 w-4 shrink-0 text-[var(--token-text-muted)]"
                      aria-hidden
                    />
                    <a href={`mailto:${email}`} className={CONTACT_LINK_CLASS}>
                      {email}
                    </a>
                  </li>
                ) : null}
                {hasFacebook ? (
                  <li className="flex min-w-0 items-start gap-2">
                    <Facebook
                      className="mt-0.5 h-4 w-4 shrink-0 text-[var(--token-text-muted)]"
                      aria-hidden
                    />
                    <a
                      href={facebookUrl!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={CONTACT_LINK_CLASS}
                    >
                      Facebook
                    </a>
                  </li>
                ) : null}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}

      {hasActions ? (
        <section
          className={`min-w-0 ${EVENT_DETAILS_VENUE_SECTION_WELL_CLASS}`}
          aria-labelledby={`${idPrefix}-actions-title`}
        >
          <h5 id={`${idPrefix}-actions-title`} className={`${typography.overviewEyebrow} mb-2`}>
            Actions
          </h5>
          <div className="flex flex-wrap gap-2" role="group" aria-label={actionsAriaLabel}>
            {mapsHref ? (
              <a
                href={mapsHref}
                target="_blank"
                rel="noopener noreferrer"
                className={ACTION_BTN_CLASS}
              >
                <MapIcon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                Open in Maps
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ) : null}
            {websiteHref ? (
              <a
                href={websiteHref}
                target="_blank"
                rel="noopener noreferrer"
                className={ACTION_BTN_CLASS}
              >
                <Globe className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                Visit website
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ) : null}
            {hasEmail ? (
              <a href={`mailto:${email}`} className={ACTION_BTN_CLASS}>
                <Mail className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                {emailActionLabel}
              </a>
            ) : null}
            {hasFacebook ? (
              <a
                href={facebookUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className={ACTION_BTN_CLASS}
              >
                <Facebook className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                Facebook
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  )
}

export type OverviewVenueContactFieldsProps = {
  phone?: string | null
  website?: string | null
  email?: string | null
  facebookUrl?: string | null
  /** LiveRC track dashboard URL (same as event host heading link). */
  livercTrackUrl?: string | null
}

/**
 * Compact contact links for summary columns (no inner section heading).
 * Link size and color match {@link MapSearchAddressLink} full-address mode in the overview glance.
 */
export function OverviewVenueContactFields({
  phone = null,
  website = null,
  email = null,
  facebookUrl = null,
  livercTrackUrl = null,
}: OverviewVenueContactFieldsProps) {
  const hasPhone = !!(phone && phone.trim())
  const hasWebsite = !!(website && website.trim())
  const hasEmail = !!(email && email.trim())
  const hasFacebook = !!(facebookUrl && facebookUrl.trim())
  const hasLiverc = !!(livercTrackUrl && livercTrackUrl.trim())
  if (!hasPhone && !hasWebsite && !hasEmail && !hasFacebook && !hasLiverc) return null

  const websiteHref = hasWebsite
    ? website!.startsWith("http")
      ? website!
      : `https://${website}`
    : null

  const livercHref = hasLiverc
    ? livercTrackUrl!.trim().startsWith("http")
      ? livercTrackUrl!.trim()
      : `https://${livercTrackUrl!.trim()}`
    : null

  return (
    <ul className="m-0 flex w-full min-w-0 list-none flex-col items-stretch gap-2 p-0 text-left">
      {hasPhone ? (
        <li className="flex min-w-0 max-w-full items-start justify-start gap-1.5">
          <Phone
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--token-text-muted)]"
            aria-hidden
          />
          <a href={`tel:${phone!.replace(/\s/g, "")}`} className={CONTACT_GLANCE_LINK_CLASS}>
            {phone}
          </a>
        </li>
      ) : null}
      {hasWebsite && websiteHref ? (
        <li className="flex min-w-0 max-w-full items-start justify-start gap-1.5">
          <Globe
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--token-text-muted)]"
            aria-hidden
          />
          <a
            href={websiteHref}
            target="_blank"
            rel="noopener noreferrer"
            className={CONTACT_GLANCE_LINK_CLASS}
            title={website!.trim()}
            aria-label={`Visit club homepage (opens in new tab): ${website!.trim()}`}
          >
            Club Homepage
          </a>
        </li>
      ) : null}
      {hasLiverc && livercHref ? (
        <li className="flex min-w-0 max-w-full items-start justify-start gap-1.5">
          <ExternalLink
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--token-text-muted)]"
            aria-hidden
          />
          <a
            href={livercHref}
            target="_blank"
            rel="noopener noreferrer"
            className={CONTACT_GLANCE_LINK_CLASS}
            title={livercHref}
            aria-label={`Open track homepage (opens in new tab on LiveRC): ${livercHref}`}
          >
            Track Homepage
          </a>
        </li>
      ) : null}
      {hasEmail ? (
        <li className="flex min-w-0 max-w-full items-start justify-start gap-1.5">
          <Mail
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--token-text-muted)]"
            aria-hidden
          />
          <a
            href={`mailto:${email}`}
            className={CONTACT_GLANCE_LINK_CLASS}
            title={email!.trim()}
            aria-label={`Send email to ${email!.trim()}`}
          >
            Email
          </a>
        </li>
      ) : null}
      {hasFacebook ? (
        <li className="flex min-w-0 max-w-full items-start justify-start gap-1.5">
          <Facebook
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--token-text-muted)]"
            aria-hidden
          />
          <a
            href={facebookUrl!}
            target="_blank"
            rel="noopener noreferrer"
            className={CONTACT_GLANCE_LINK_CLASS}
          >
            Facebook
          </a>
        </li>
      ) : null}
    </ul>
  )
}
