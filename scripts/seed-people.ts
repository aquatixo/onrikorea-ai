import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const db = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });

async function main() {
  const names = ["안동헌", "오성민", "현명수"];
  for (const name of names) {
    await db.person.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log(`Seeded ${names.length} people.`);
}

main().finally(() => db.$disconnect());
