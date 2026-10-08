import type { DefaultSession } from "next-auth";
import type { UserRole } from "@/lib/access-control";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      allowedPages: string[];
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
    allowedPages: string[];
    authStamp?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole;
    allowedPages?: string[];
    authStamp?: string;
  }
}
