import "dotenv/config";
import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth/password";

const USERS = [
  { username: "osm1016@onrikorea.com", name: "오성민" },
  { username: "hyunms@onrikorea.com", name: "현명수" },
  { username: "jake@onrikorea.com", name: "안동헌" },
  { username: "admin", name: "어드민" },
];

// Passed via env, never hardcoded -- this file is committed to the repo, and a
// literal password constant here would put a real credential in git history.
// Usage: SEED_USER_PASSWORD='...' npx tsx scripts/seed-users.ts
const PASSWORD = process.env.SEED_USER_PASSWORD;

async function main() {
  if (!PASSWORD) {
    console.error("Set SEED_USER_PASSWORD before running this script.");
    process.exit(1);
  }
  const passwordHash = await hashPassword(PASSWORD);
  for (const u of USERS) {
    await db.user.upsert({
      where: { username: u.username },
      update: { name: u.name, passwordHash },
      create: { username: u.username, name: u.name, passwordHash },
    });
    console.log(`  + ${u.username} (${u.name})`);
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
