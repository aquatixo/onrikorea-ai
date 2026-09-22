import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { authConfig } from "@/auth.config";

// Full config -- everything here runs in a real Node.js context (route handlers,
// Server Components, Server Actions), never in middleware, so importing Prisma is
// safe. See auth.config.ts for why middleware can't share this file directly.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
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
        return { id: user.id, name: user.name };
      },
    }),
  ],
});
