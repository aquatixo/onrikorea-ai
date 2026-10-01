// Edge-safe (no Prisma/Node imports) -- used both by proxy.ts (Edge runtime) and by
// client components deciding what nav to render. The Prisma UserRole enum has the
// same values; kept as a plain string union here so this file has zero deps.
export type UserRole = "ADMIN" | "DEVELOPER" | "USER";

export const PAGE_SECTIONS = ["brands", "brandSourcing", "work", "stores", "storeVisits", "products"] as const;
export type PageSection = (typeof PAGE_SECTIONS)[number];

// Ordered by specificity -- a more specific prefix (e.g. /brands/sourcing) must be
// checked before a shorter one it's nested under (/brands) or it would never match.
//
// /settings and /settings/password are deliberately NOT in this map -- every signed-in
// user must always be able to reach the settings hub and change their own password,
// regardless of allowedPages. (An earlier version gated /settings behind a checkbox
// like every other section; a user created without it checked -- the default for a
// brand-new account -- could never change their own password, with no recovery path
// short of an admin repeatedly resetting it to the same shared default. Never repeat
// that mistake.) /settings/users (admin user management) is separately hard-gated to
// role === "ADMIN" in proxy.ts, not delegable via allowedPages at all.
const SECTION_BY_PATH_PREFIX: [string, PageSection][] = [
  ["/brands/sourcing", "brandSourcing"],
  ["/brands", "brands"],
  ["/work", "work"],
  ["/field/stores", "stores"],
  ["/field/store-visits", "storeVisits"],
  ["/field/products", "products"],
];

/** null means the path isn't gated at all (dashboard home, login, soon-placeholders). */
export function sectionForPath(pathname: string): PageSection | null {
  for (const [prefix, section] of SECTION_BY_PATH_PREFIX) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return section;
  }
  return null;
}

export function hasSectionAccess(role: UserRole, allowedPages: string[], section: PageSection): boolean {
  // DEVELOPER gets the same full section access as ADMIN -- the thing it's actually
  // restricted from (a WorkItem flagged isSecure) is a content-level filter applied
  // where WorkItem is queried, not a section-level gate like this one.
  return role === "ADMIN" || role === "DEVELOPER" || allowedPages.includes(section);
}

export function hasPathAccess(role: UserRole, allowedPages: string[], pathname: string): boolean {
  const section = sectionForPath(pathname);
  if (!section) return true;
  return hasSectionAccess(role, allowedPages, section);
}
