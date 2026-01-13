/**
 * @fileoverview Event Search page - Redirects to unified search
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2026-01-XX
 * 
 * @description Redirects to the new unified search page
 * 
 * @note This page is kept for backwards compatibility (bookmarks, etc.)
 *       but redirects to the new /search page
 */

import { redirect } from "next/navigation"

export default function EventSearchPage() {
  redirect("/search")
}
