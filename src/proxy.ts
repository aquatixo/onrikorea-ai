import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// A separate, Edge-safe NextAuth instance built from ONLY the Edge-safe half of the
// config (see auth.config.ts) -- importing `auth` from the full src/auth.ts instead
// would pull Prisma's Node-only `pg` driver into the bundle. Checking an
// already-issued JWT cookie needs none of that.
//
// The local `const` + separate `export { ... as proxy }` (rather than
// `export const { auth: proxy } = NextAuth(authConfig)` inline) matters here --
// Next.js's build-time check for "does this file export a function" didn't
// recognize the destructured-inline form, even though it ran fine under local dev.
const { auth } = NextAuth(authConfig);

export { auth as proxy };

// Every request runs through auth.config.ts's `authorized` callback, which allows
// /login through and redirects everything else to it when there's no session --
// this is what makes the login page appear no matter which URL was requested.
// Excluded here: static assets and the auth API routes themselves (redirecting
// those would break the sign-in POST or the Next.js asset pipeline).
export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
