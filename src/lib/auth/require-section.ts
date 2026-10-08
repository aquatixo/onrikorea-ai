import type { Session } from "next-auth";
import { auth } from "@/auth";
import { hasSectionAccess, type PageSection } from "@/lib/access-control";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

/**
 * First call in every Server Action. Server Actions are callable directly (their ids are
 * in the client bundles), and proxy.ts only checks the JWT cookie -- it can't see that an
 * admin revoked the user or the section since. auth() here runs the session re-check in
 * src/auth.ts, so a revoked, deleted or section-less user is refused.
 *
 * Returns the session when allowed, null when not.
 */
export async function requireSection(section: PageSection): Promise<Session | null> {
  const session = await auth();
  if (!session?.user) return null;
  return hasSectionAccess(session.user.role, session.user.allowedPages, section) ? session : null;
}

export async function noAccessMessage(): Promise<string> {
  return getDictionary(await getLocale()).common.noSectionAccess;
}
