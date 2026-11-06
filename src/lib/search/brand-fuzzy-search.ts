import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Typo-tolerant brand search inside Postgres (pg_trgm + unaccent on Supabase) -- no search
 * server to keep running. A brand matches when its name, country or SKU contains the query
 * (the old search), or when its name is close enough to it: "maizon" finds Maison, "de-la"
 * finds "de la", "lamaison" finds La Maison, "Mathes" finds Mathez. Accents and case don't
 * count (Nestle = Nestlé).
 *
 * Order: contains-matches first, then the closest names, then brand number. Returns null if
 * the query fails (e.g. the extensions are missing), so callers fall back to `contains`.
 */

// strict_word_similarity: how well the query matches a run of whole words in the name, 0-1.
// 0.4 measured on the real brand list: keeps "maizon" -> Maison Adam (0.40) and "Mathes" ->
// Mathez (0.56), leaves out "Ferero" -> Mariage Frères (0.27).
const MIN_SIMILARITY = 0.4;

export async function fuzzySearchBrandIds(
  q: string,
  { from = 0, size = 10000 }: { from?: number; size?: number } = {}
): Promise<{ ids: string[]; total: number } | null> {
  const v = Prisma.sql`unaccent(lower(${q}))`;
  const name = Prisma.sql`unaccent(lower(b.name))`;
  const contains = Prisma.sql`(
    strpos(${name}, ${v}) > 0
    OR strpos(unaccent(lower(coalesce(b.country, ''))), ${v}) > 0
    OR strpos(unaccent(lower(coalesce(b.sku, ''))), ${v}) > 0
  )`;
  const similarity = Prisma.sql`strict_word_similarity(${v}, ${name})`;
  const where = Prisma.sql`${contains} OR ${similarity} >= ${MIN_SIMILARITY}`;
  try {
    const [rows, counted] = await Promise.all([
      db.$queryRaw<{ id: string }[]>`
        SELECT b.id FROM "Brand" b
        WHERE ${where}
        ORDER BY ${contains} DESC, ${similarity} DESC, b."sourceNo" ASC NULLS LAST, b.id
        LIMIT ${size} OFFSET ${from}`,
      db.$queryRaw<{ total: bigint }[]>`SELECT count(*) AS total FROM "Brand" b WHERE ${where}`,
    ]);
    return { ids: rows.map((r) => r.id), total: Number(counted[0]?.total ?? 0) };
  } catch (e) {
    console.warn("[brand-fuzzy-search] failed, falling back to contains:", e instanceof Error ? e.message : e);
    return null;
  }
}
