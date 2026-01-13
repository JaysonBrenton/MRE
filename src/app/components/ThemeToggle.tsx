/**
 * @fileoverview Theme toggle component
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Client component that toggles between dark and light themes
 * 
 * @purpose Provides a button to switch themes. Toggles the .light class on
 *          document.documentElement and persists preference to localStorage.
 * 
 * @relatedFiles
 * - app/globals.css (theme token definitions)
 * - app/components/AppShell.tsx (where this component is used)
 */

"use client"

import { startTransition, useEffect, useState } from "react"

export default function ThemeToggle() {
  const [isLight, setIsLight] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    // Read saved preference
    const savedTheme = window.localStorage.getItem("mre-theme")
    const prefersLight = savedTheme === "light"
    startTransition(() => {
      setIsLight(prefersLight)
    })

    if (prefersLight) {
      document.documentElement.classList.add("light")
    } else {
      document.documentElement.classList.remove("light")
    }
  }, [])

  const toggleTheme = () => {
    const newIsLight = !isLight
    setIsLight(newIsLight)
    
    if (newIsLight) {
      document.documentElement.classList.add("light")
      localStorage.setItem("mre-theme", "light")
    } else {
      document.documentElement.classList.remove("light")
      localStorage.setItem("mre-theme", "dark")
    }
  }

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center justify-center rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-4 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface-raised)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
      aria-label={isLight ? "Switch to dark theme" : "Switch to light theme"}
    >
      {isLight ? (
        <span className="text-lg" aria-hidden="true">🌙</span>
      ) : (
        <span className="text-lg" aria-hidden="true">☀️</span>
      )}
    </button>
  )
}
