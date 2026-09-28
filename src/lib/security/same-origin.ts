import type { NextRequest } from "next/server";

/**
 * Defense-in-depth Origin check for state-changing plain API routes (Server Actions get
 * this from Next.js automatically; route handlers don't). Session-cookie auth alone
 * doesn't stop a cross-site POST -- SameSite=Lax blocks the classic form-based case, but
 * this adds an explicit check for routes worth the extra assurance.
 */
export function isTrustedRequestOrigin(request: NextRequest): boolean {
  const host = request.headers.get("host");
  const origin = request.headers.get("origin") ?? request.headers.get("referer");
  if (!host || !origin) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
