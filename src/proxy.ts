import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { hasPathAccess } from "@/lib/access-control";

// A separate, Edge-safe NextAuth instance built from ONLY the Edge-safe half of the
// config (see auth.config.ts) -- importing `auth` from the full src/auth.ts instead
// would pull Prisma's Node-only `pg` driver into the bundle. Checking an
// already-issued JWT cookie needs none of that.
//
// The local `const` + separate named export (rather than an inline destructured
// export) matters here -- Next.js's build-time check for "does this file export a
// function" didn't recognize the destructured-inline form, even though it ran fine
// under local dev.
const { auth } = NextAuth(authConfig);

// Wrapping `auth` with a handler (rather than exporting it directly, as before) lets
// this distinguish "not signed in" (→ /login) from "signed in but not allowed to see
// this section" (→ / with a notice) -- NextAuth's own `authorized` callback can only
// express a single boolean and always redirects to `pages.signIn` either way.
// python-sourcing/main.py calls /api/brands/evaluate-candidate directly (server-to-
// server, no browser session) carrying this shared secret instead -- without this,
// the redirect-to-/login below fired before the request ever reached that route's own
// requireSectionAccess bypass, so the Python script got back a login-page HTML
// response instead of a JSON evaluation and every candidate failed to parse it.
// Plain string comparison, not a timing-safe one, since this must stay Edge-runtime
// compatible (no Node `crypto` module here) -- the secret is long/random enough that
// this is an acceptable tradeoff for a locally-run internal script. Scoped to exactly
// this one path (not "any path carrying the secret") so a leaked secret can only ever
// skip auth for this single mechanical evaluation endpoint, not the whole app.
const INTERNAL_SECRET_PATH = "/api/brands/evaluate-candidate";

function hasValidInternalSecret(req: { headers: Headers }): boolean {
  const expected = process.env.INTERNAL_API_SECRET;
  const provided = req.headers.get("x-internal-secret");
  return !!expected && !!provided && expected === provided;
}

const proxy = auth((req) => {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/login")) return;
  if (pathname === INTERNAL_SECRET_PATH && hasValidInternalSecret(req)) return;

  if (!req.auth?.user) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  const { role, allowedPages } = req.auth.user;
  // Boundary-safe, matching sectionForPath's own prefix check -- a bare startsWith
  // would also (mis)match a hypothetical future route like /settings/users-export.
  const isUsersAdminPath = pathname === "/settings/users" || pathname.startsWith("/settings/users/");
  const deniedUsersPage = isUsersAdminPath && role !== "ADMIN";
  if (deniedUsersPage || !hasPathAccess(role, allowedPages, pathname)) {
    return NextResponse.redirect(new URL("/?denied=1", req.url));
  }
});

export { proxy };

// Every request runs through the handler above, which allows /login through and
// redirects everything else to it when there's no session -- this is what makes the
// login page appear no matter which URL was requested. Excluded here: static assets
// and the auth API routes themselves (redirecting those would break the sign-in POST
// or the Next.js asset pipeline).
export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
