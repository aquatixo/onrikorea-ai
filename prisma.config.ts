import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Direct (non-pooled) connection — required for migrate/db push/introspection.
    // The pooled connection (DATABASE_URL) is used separately by the runtime PrismaClient in src/lib/db.ts.
    url: env("DIRECT_URL"),
  },
});
