import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// A separate, Edge-safe NextAuth instance built from ONLY the Edge-safe half of the
// config (see auth.config.ts) -- importing `middleware` from the full src/auth.ts
// instead would pull Prisma's Node-only `pg` driver into the Edge middleware bundle
// and crash the server. Checking an already-issued JWT cookie needs none of that.
export const { auth: middleware } = NextAuth(authConfig);

// Every request runs through auth.config.ts's `authorized` callback, which allows
// /login through and redirects everything else to it when there's no session --
// this is what makes the login page appear no matter which URL was requested.
// Excluded here: static assets and the auth API routes themselves (redirecting
// those would break the sign-in POST or the Next.js asset pipeline).
export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
