import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@/lib/access-control";

// Edge-safe half of the config -- no Credentials provider, no Prisma import. This is
// the part middleware.ts uses directly: checking whether an already-issued JWT cookie
// is valid needs none of that, and Next.js middleware runs on the Edge runtime, which
// can't load Prisma's `pg`-based Node driver at all. The Credentials provider (which
// does need `@/lib/db`) only ever runs inside a real Node.js route handler (the
// /api/auth/callback/credentials POST), never inside middleware -- see src/auth.ts.
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    // No `authorized` callback here -- proxy.ts wraps `auth` with its own handler
    // (rather than exporting `auth` directly as middleware), so it makes every
    // sign-in/permission redirect decision itself instead of deferring to this.
    jwt({ token, user }) {
      // Only set when `user` is present (sign-in time) -- role/allowedPages changes
      // made later via the admin's user-management page take effect on next sign-in,
      // not live, since JWT sessions have no server-side store to push an update through.
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.allowedPages = user.allowedPages;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as UserRole | undefined) ?? "USER";
        session.user.allowedPages = (token.allowedPages as string[] | undefined) ?? [];
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
