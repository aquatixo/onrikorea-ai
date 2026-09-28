import { auth } from "@/auth";
import { isOwnerOrAdmin } from "@/lib/auth/ownership";

// For Server Actions, which only have a record id and haven't already loaded the
// session the way a page component has. Fetches the session itself. Server-only (pulls
// in "@/auth" -> Prisma) -- never import this from a client component; use
// isOwnerOrAdmin from ownership.ts directly there instead.
export async function canModifyContent(createdById: string | null): Promise<boolean> {
  const session = await auth();
  return isOwnerOrAdmin(session?.user ?? null, createdById);
}
