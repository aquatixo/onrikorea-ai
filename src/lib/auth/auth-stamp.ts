import { createHash } from "crypto";
import { cache } from "react";
import { db } from "@/lib/db";

type StampSource = { role: string; allowedPages: string[]; passwordHash: string };

// Fingerprint of everything whose change must end a session: role, page access and the
// password (an admin's reset included). A user's display name is deliberately left out.
export function authStamp(user: StampSource): string {
  const pages = [...user.allowedPages].sort().join(",");
  return createHash("sha256").update(`${user.role}|${pages}|${user.passwordHash}`).digest("hex").slice(0, 32);
}

export type CurrentAuthUser = { role: string; allowedPages: string[]; stamp: string };

// One DB read per request, however many times auth() is called while rendering it.
export const loadCurrentAuthUser = cache(async (userId: string): Promise<CurrentAuthUser | null> => {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, allowedPages: true, passwordHash: true },
  });
  return user ? { role: user.role, allowedPages: user.allowedPages, stamp: authStamp(user) } : null;
});

type TokenLike = { id?: string; role?: string; allowedPages?: string[]; authStamp?: string };

/**
 * Whether a session token still matches the user as stored now. JWT sessions are
 * stateless, so without this a permission change made by an admin only took effect at the
 * user's next sign-in (sessions roll for 30 days). Returns the token to keep (possibly
 * upgraded with a stamp) or null to end the session.
 */
export async function freshToken<T extends object>(
  token: T,
  load: (userId: string) => Promise<CurrentAuthUser | null> = loadCurrentAuthUser
): Promise<T | null> {
  const t = token as TokenLike;
  if (typeof t.id !== "string" || !t.id) return null;
  const current = await load(t.id);
  if (!current) return null; // user deleted
  if (t.authStamp) return t.authStamp === current.stamp ? token : null;
  // Session issued before stamps existed: compare the fields it carries instead, and
  // adopt the stamp so the next check is the cheap one.
  const samePages = [...(t.allowedPages ?? [])].sort().join(",") === [...current.allowedPages].sort().join(",");
  if (t.role !== current.role || !samePages) return null;
  return { ...token, authStamp: current.stamp };
}
