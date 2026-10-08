import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";

// Server Components can't delete cookies, so a page that finds its session invalidated
// (an admin changed this user's permissions or password -- see lib/auth/auth-stamp.ts)
// redirects here, where clearing the session cookie is allowed.
export async function GET() {
  // Only ever end a session that is already invalid: a plain GET must not let any link or
  // image on another site log a signed-in user out.
  const session = await auth();
  if (session?.user) redirect("/");
  await signOut({ redirectTo: "/login?expired=1" });
}
