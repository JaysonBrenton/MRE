/**
 * @fileoverview Logout button component for user authentication
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Provides a sign-out button that triggers the logout server action
 *
 * @purpose This component handles user logout functionality. It renders a button
 *          that, when clicked, calls the logout server action and redirects the
 *          user to the login page. It is used across authenticated pages to
 *          provide consistent logout functionality.
 *
 * @relatedFiles
 * - src/app/actions/auth.ts (logout server action)
 * - src/app/login/page.tsx (redirect destination)
 */

import { logout } from "@/app/actions/auth"

interface LogoutButtonProps {
  variant?: "default" | "compact"
}

export default function LogoutButton({ variant = "default" }: LogoutButtonProps) {
  const isCompact = variant === "compact"

  return (
    <form action={logout}>
      <button
        type="submit"
        className={`flex items-center justify-center rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] ${
          isCompact ? "w-full px-3 py-2 text-xs" : "px-4 text-sm"
        } font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface-raised)] active:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]`}
      >
        Sign out
      </button>
    </form>
  )
}
