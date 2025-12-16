import { logout } from "@/app/actions/auth"

export default function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="mobile-button flex items-center justify-center px-4 text-sm font-medium text-[var(--token-button-primary-text)] bg-[var(--token-button-primary-bg)] hover:bg-[var(--token-button-primary-bg-hover)] active:opacity-90 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] transition-colors"
      >
        Sign out
      </button>
    </form>
  )
}
