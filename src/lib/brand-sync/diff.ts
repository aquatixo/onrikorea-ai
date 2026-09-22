import type { ParsedBrandRow } from "@/lib/brand-import/parse";
import { extractDomain } from "@/lib/extract-domain";

// Same normalization the rest of the app already uses for "is this the same brand"
// (see import-actions.ts's duplicate check, dedup.ts's normalizeName) -- trim +
// lowercase, nothing fancier. Introducing a different, more sophisticated matching
// scheme just for this one feature would make "is this a duplicate" mean two
// different things depending on which code path asks.
function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export type BrandSyncDiff<T extends { name: string }> = {
  /** In the DB, missing from the sheet -- these get appended when the sheet is rebuilt. */
  dbOnly: T[];
  /** In the sheet, missing from the DB -- these get created as new Brand rows. */
  sheetOnly: ParsedBrandRow[];
  /** Matched by name on both sides -- left untouched (see module doc below). */
  matchedCount: number;
};

/**
 * Compares the DB's current Brand list against a freshly-parsed SharePoint sheet and
 * sorts every row into exactly one bucket, by normalized name.
 *
 * Deliberately does NOT attempt field-level conflict resolution: with no single
 * master, silently overwriting a value that already exists on one side risks losing
 * real data. A brand present on both sides is left as-is here -- when the sheet gets
 * rebuilt from the DB afterward (see the merge route), the DB's field values are what
 * end up in the sheet for those rows, same as the original one-way sync already did.
 * The part this actually fixes is brands missing entirely from one side, which is
 * what "no brand left behind" was about.
 */
export function diffBrandsAgainstSheet<T extends { name: string }>(
  dbBrands: T[],
  sheetRows: ParsedBrandRow[]
): BrandSyncDiff<T> {
  const dbNames = new Map<string, T>();
  for (const b of dbBrands) dbNames.set(normalizeName(b.name), b);

  const sheetNames = new Set(sheetRows.map((r) => normalizeName(r.name)));

  const dbOnly = dbBrands.filter((b) => !sheetNames.has(normalizeName(b.name)));
  const sheetOnly = sheetRows.filter((r) => !dbNames.has(normalizeName(r.name)));
  const matchedCount = dbBrands.length - dbOnly.length;

  return { dbOnly, sheetOnly, matchedCount };
}

export type SheetOnlyCreateInput = ReturnType<typeof toBrandCreateInput>;

/** Maps a sheet-only row into a Brand create() input, same field mapping the manual
 * Excel importer already uses (import-actions.ts) -- kept identical on purpose. */
export function toBrandCreateInput(row: ParsedBrandRow, sourceNo: number) {
  return {
    sourceNo,
    methodology: row.methodology ?? undefined,
    name: row.name,
    country: row.country ?? undefined,
    sku: row.sku ?? undefined,
    foundedYear: row.foundedYear ?? undefined,
    website: row.website ?? undefined,
    websiteDomain: extractDomain(row.website ?? undefined),
    contactPoint: row.contactPoint ?? undefined,
    coldEmail: row.coldEmail,
    reply: row.reply,
  };
}
