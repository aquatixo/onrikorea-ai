import type { NextAuthConfig } from "next-auth";

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
    authorized({ request, auth }) {
      if (request.nextUrl.pathname.startsWith("/login")) return true;
      return !!auth?.user;
    },
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user) session.user.id = token.id as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
