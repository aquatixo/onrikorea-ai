import { auth } from "@/auth";
import { hasSectionAccess, type PageSection } from "@/lib/access-control";

/**
 * API-route counterpart to proxy.ts's page-level gating -- proxy.ts only recognizes UI
 * page prefixes (see SECTION_BY_PATH_PREFIX), so it never actually restricts
 * /api/brands/** endpoints. Without this, a signed-in user with "brands" unchecked in
 * allowedPages could still call these routes directly and read/write brand data despite
 * the section being hidden from them everywhere in the UI.
 *
 * Returns a Response to send as-is when access should be denied, or null when the
 * caller should proceed.
 */
export async function requireSectionAccess(section: PageSection): Promise<Response | null> {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasSectionAccess(session.user.role, session.user.allowedPages, section)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
