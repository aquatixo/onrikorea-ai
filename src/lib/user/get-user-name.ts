import { auth } from "@/auth";

// Middleware already guarantees a session exists on every route this can be called
// from (see src/middleware.ts) -- the fallback string only matters for the rare case
// of this running somewhere middleware doesn't cover.
export async function getUserName(): Promise<string> {
  const session = await auth();
  return session?.user?.name ?? "Unknown";
}
