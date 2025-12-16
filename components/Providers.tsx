"use client"

import { ReactNode } from "react"

export default function Providers({ children }: { children: ReactNode }) {
  // NextAuth v5 doesn't require SessionProvider
  return <>{children}</>
}

