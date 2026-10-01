type SessionUser = { id: string; role: "ADMIN" | "DEVELOPER" | "USER" };

// The one rule for every content model with a createdById: an ADMIN can touch anything;
// anyone else can only touch what they created. A null createdById (pre-existing rows
// from before this field existed, or a deleted author) is nobody's -- only ADMIN can
// touch those.
//
// Deliberately kept dependency-free (no "@/auth", no Prisma) -- client components import
// this directly to decide whether to render an edit/delete control. Pulling in "@/auth"
// here would drag the Node-only `pg` driver into the browser bundle transitively via
// src/lib/db.ts, breaking any client component that imports this file.
export function isOwnerOrAdmin(user: SessionUser | null | undefined, createdById: string | null): boolean {
  if (!user) return false;
  return user.role === "ADMIN" || (createdById !== null && createdById === user.id);
}
