import type { ReactElement } from "react"

export interface NavItem {
  href: string
  label: string
  description: string
  icon: (active: boolean) => ReactElement
}

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/eventAnalysis",
    label: "My Event Analysis",
    description: "Mission control overview",
    icon: (active) => (
      <svg
        className={`h-5 w-5 ${active ? "text-[var(--token-accent)]" : "text-[var(--token-text-secondary)]"}`}
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/search",
    label: "Global Search",
    description: "Search events and sessions",
    icon: (active) => (
      <svg
        className={`h-5 w-5 ${active ? "text-[var(--token-accent)]" : "text-[var(--token-text-secondary)]"}`}
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={1.5} />
        <path
          d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
          stroke="currentColor"
          strokeWidth={1.5}
        />
        <path d="M2 12h20" stroke="currentColor" strokeWidth={1.5} />
      </svg>
    ),
  },
  {
    href: "/eventAnalysis/my-telemetry",
    label: "My Telemetry",
    description: "Data sources & traces",
    icon: (active) => (
      <svg
        className={`h-5 w-5 ${active ? "text-[var(--token-accent)]" : "text-[var(--token-text-secondary)]"}`}
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M4 14c2.5-4 4.5-4 7 0s4.5 4 7 0"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <path d="M3 6h18v12H3z" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/eventAnalysis/car-profiles",
    label: "My Car Profiles",
    description: "Manage car profiles & setups",
    icon: (active) => (
      <svg
        className={`h-5 w-5 ${active ? "text-[var(--token-accent)]" : "text-[var(--token-text-secondary)]"}`}
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M5 17H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-1"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="m12 15 2 2 4-4"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M9 9h6M9 12h6M9 15h3"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: "/eventAnalysis/driver-profiles",
    label: "My Driver Profiles",
    description: "Manage driver profiles",
    icon: (active) => (
      <svg
        className={`h-5 w-5 ${active ? "text-[var(--token-accent)]" : "text-[var(--token-text-secondary)]"}`}
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth={1.5} />
      </svg>
    ),
  },
  {
    href: "/eventAnalysis/my-engineer",
    label: "My Engineer",
    description: "Racing intelligence hub",
    icon: (active) => (
      <svg
        className={`h-5 w-5 ${active ? "text-[var(--token-accent)]" : "text-[var(--token-text-secondary)]"}`}
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M12 14a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 0c-5 0-7 3-7 5v1h14v-1c0-2-2-5-7-5z"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/under-development?from=/eventAnalysis/my-club",
    label: "My Club",
    description: "Home club dashboard & community",
    icon: (active) => (
      <svg
        className={`h-5 w-5 ${active ? "text-[var(--token-accent)]" : "text-[var(--token-text-secondary)]"}`}
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M3 21h18M5 21V7l7-4 7 4v14"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M9 9v6m6-6v6"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="4" r="1.5" stroke="currentColor" strokeWidth={1.5} />
      </svg>
    ),
  },
  {
    href: "/under-development?from=/eventAnalysis/my-team",
    label: "My Team",
    description: "Team dashboard & insights",
    icon: (active) => (
      <svg
        className={`h-5 w-5 ${active ? "text-[var(--token-accent)]" : "text-[var(--token-text-secondary)]"}`}
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth={1.5} />
        <path
          d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
]

export interface GuideItem {
  href: string
  label: string
  icon: (active: boolean) => ReactElement
}

export const GUIDE_ITEMS: GuideItem[] = [
  {
    href: "/guides/getting-started",
    label: "Getting Started",
    icon: (active) => (
      <svg
        className={`h-5 w-5 ${active ? "text-[var(--token-accent)]" : "text-[var(--token-text-secondary)]"}`}
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
    ),
  },
  {
    href: "/guides/event-search",
    label: "Event Search",
    icon: (active) => (
      <svg
        className={`h-5 w-5 ${active ? "text-[var(--token-accent)]" : "text-[var(--token-text-secondary)]"}`}
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth={1.5} />
        <path d="m20 20-4-4" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/guides/event-analysis",
    label: "Event Analysis",
    icon: (active) => (
      <svg
        className={`h-5 w-5 ${active ? "text-[var(--token-accent)]" : "text-[var(--token-text-secondary)]"}`}
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M3 3v18h18M7 16l4-4 4 4 6-6"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/guides/car-type-mapping",
    label: "Car type mapping",
    icon: (active) => (
      <svg
        className={`h-5 w-5 ${active ? "text-[var(--token-accent)]" : "text-[var(--token-text-secondary)]"}`}
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M13.828 10.172a4 4 0 0 0-5.656 0l-4 4a4 4 0 1 0 5.656 5.656l1.102-1.101m-.758-4.899a4 4 0 0 0 5.656 0l4-4a4 4 0 1 0-5.656-5.656l-1.1 1.1"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/guides/dashboard",
    label: "My Event Analysis",
    icon: (active) => (
      <svg
        className={`h-5 w-5 ${active ? "text-[var(--token-accent)]" : "text-[var(--token-text-secondary)]"}`}
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/guides/driver-features",
    label: "Driver Features",
    icon: (active) => (
      <svg
        className={`h-5 w-5 ${active ? "text-[var(--token-accent)]" : "text-[var(--token-text-secondary)]"}`}
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M12 14a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 0c-5 0-7 3-7 5v1h14v-1c0-2-2-5-7-5z"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/guides/navigation",
    label: "Navigation",
    icon: (active) => (
      <svg
        className={`h-5 w-5 ${active ? "text-[var(--token-accent)]" : "text-[var(--token-text-secondary)]"}`}
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M3 12h18M3 6h18M3 18h18"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: "/guides/account-management",
    label: "Account Management",
    icon: (active) => (
      <svg
        className={`h-5 w-5 ${active ? "text-[var(--token-accent)]" : "text-[var(--token-text-secondary)]"}`}
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/guides/troubleshooting",
    label: "Troubleshooting",
    icon: (active) => (
      <svg
        className={`h-5 w-5 ${active ? "text-[var(--token-accent)]" : "text-[var(--token-text-secondary)]"}`}
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={1.5} />
        <path
          d="M12 16v-4M12 8h.01"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      </svg>
    ),
  },
]

export const STORAGE_KEY_GUIDES_EXPANDED = "mre-user-guides-expanded"
export const STORAGE_KEY_MY_CLUB_EXPANDED = "mre-my-club-expanded"

export const ADMIN_NAV_ITEM: NavItem = {
  href: "/admin",
  label: "MRE Administration",
  description: "System administration console",
  icon: (active) => (
    <svg
      className={`h-5 w-5 ${active ? "text-[var(--token-accent)]" : "text-[var(--token-text-secondary)]"}`}
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
}

export function myEventsNavIcon(active: boolean) {
  return (
    <svg
      className={`h-5 w-5 ${active ? "text-[var(--token-accent)]" : "text-[var(--token-text-secondary)]"}`}
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9 14h6M9 18h4" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  )
}
