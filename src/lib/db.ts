import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Pooled connection (transaction-mode pgbouncer, port 6543) — correct for app runtime queries.
// The direct connection (DIRECT_URL) is only used by prisma.config.ts for CLI/migrations.
const adapter = new PrismaPg(process.env.DATABASE_URL!);

export const db = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
