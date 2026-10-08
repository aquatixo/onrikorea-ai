import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { authStamp, freshToken } from "@/lib/auth/auth-stamp";
import { authConfig } from "@/auth.config";

// Full config -- everything here runs in a real Node.js context (route handlers,
// Server Components, Server Actions), never in middleware, so importing Prisma is
// safe. See auth.config.ts for why middleware can't share this file directly.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt(params) {
      const token = authConfig.callbacks.jwt(params);
      if (params.user) {
        token.authStamp = params.user.authStamp;
        return token;
      }
      // Every server-side session read re-checks the token against the user's current
      // role/pages/password, so an admin's change ends the session on the user's next
      // request. (proxy.ts runs on the Edge without DB access and skips this check; the
      // dashboard layout catches it one step later -- see app/login/expired/route.ts.)
      return freshToken(token);
    },
  },
  providers: [
    Credentials({
      credentials: {
        username: { label: "아이디" },
        password: { label: "비밀번호", type: "password" },
      },
      async authorize(credentials) {
        const username = credentials?.username;
        const password = credentials?.password;
        if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
          return null;
        }
        const user = await db.user.findUnique({ where: { username } });
        if (!user) return null;
        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) return null;
        return {
          id: user.id,
          name: user.name,
          role: user.role,
          allowedPages: user.allowedPages,
          authStamp: authStamp(user),
        };
      },
    }),
  ],
});
