import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function AdminTracksPage() {
  const session = await auth()
  if (!session) {
    redirect("/login")
  }
  if (!session.user.isAdmin) {
    redirect("/welcome")
  }
  redirect("/under-development")
}
