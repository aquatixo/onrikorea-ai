import { db } from "@/lib/db";
import { similarityRatio } from "@/lib/brand-sourcing/similarity";
import { extractDomain } from "@/lib/extract-domain";
import { toKoreanCountryName } from "@/lib/brand-sourcing/country-names-ko";

const FUZZY_CUTOFF = 0.84;
const MIN_PARTIAL_LENGTH = 5;

export type DuplicateMatch = {
  /** Which table this match came from -- an already-tracked Brand, or a candidate
   * surfaced by a previous (or the same) sourcing run that was never added to Brands. */
  source: "brand" | "candidate";
  brandId: string | null;
  candidateId: string | null;
  name: string;
  country: string | null;
  sku: string | null;
  sourceNo: number | null;
  matchType: "exact" | "domain" | "partial" | "fuzzy";
  score: number;
  confidence: "high" | "low";
  reason: string;
};

type ExistingRecord = {
  source: "brand" | "candidate";
  id: string;
  name: string;
  country: string | null;
  sku: string | null;
  sourceNo: number | null;
  domain: string | null;
};

export type DedupCandidate = {
  name: string;
  country?: string | null;
  sku?: string | null;
  website?: string | null;
};

// The Korean reading the sourcing engine appends to Japanese-only names ("ばいこう堂 (바이코도)").
// It is a display aid, not part of the name: left in, "さぬき和三盆のばいこう堂" never
// contained the stored name and the same shop came back under its web-shop domain.
const KOREAN_READING = /\s*[(（][가-힣\s]+[)）]\s*$/;

function normalizeName(name: string): string {
  return name.replace(KOREAN_READING, "").trim().toLowerCase();
}

// Words that say what kind of business it is, not which one: "Chocolaterie Monbana" is the
// brand "Monbana" (No.574, already contacted), but with no country/SKU stored on that row
// the partial match was only a low-confidence hint and the candidate reached the review list.
const GENERIC_NAME_WORDS = new Set([
  "chocolaterie", "chocolatier", "chocolatiers", "chocolat", "chocolate", "chocolates", "cioccolato",
  "cioccolateria", "schokolade", "confiserie", "confectionery", "confetteria", "biscuiterie",
  "biscuits", "pasticceria", "patisserie", "pâtisserie", "dolciaria", "dolci", "candy", "candies", "sweets",
  "maison", "fabbrica", "manufaktur", "company", "co", "inc", "ltd", "llc", "srl", "spa", "sa", "sas", "sl",
  "gmbh", "ag", "the", "la", "le", "les", "el",
]);

/** The name without business-type words and accents ("Chocolaterie Monbana" -> "monbana"). */
function coreName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[\s,&.\-–—|]+/)
    .filter((w) => w && !GENERIC_NAME_WORDS.has(w))
    .join(" ");
}

// Hosts many unrelated businesses sit on, so a shared domain says nothing about being the
// same brand. Brand No.153's website is a Google search link: when search results came back
// as google.com redirect links, every one of them "matched" that row by domain.
const SHARED_HOSTS = /^(?:google\.[a-z.]+|facebook\.com|instagram\.com|linktr\.ee|youtube\.com|amazon\.[a-z.]+)$/;

function isSharedHost(domain: string): boolean {
  return SHARED_HOSTS.test(domain);
}

function isGuardedPartialMatch(a: string, b: string): boolean {
  if (a.length < MIN_PARTIAL_LENGTH || b.length < MIN_PARTIAL_LENGTH) return false;
  return a.includes(b) || b.includes(a);
}

/**
 * Replaces the original prompt's "check nearby spreadsheet rows for context" heuristic
 * (which only existed because Excel has no real structured fields to check). We have
 * actual country/sku columns, so we check them directly instead of guessing from row
 * proximity -- a strictly more reliable signal for whether a name-similarity match is a
 * real duplicate or just two different brands that happen to sound alike.
 */
function crossCheckConfidence(
  candidate: DedupCandidate,
  existing: { country: string | null; sku: string | null }
): { confidence: "high" | "low"; reason: string } {
  // One language: the engine sends "Italy", Brand rows say "이탈리아" -- compared raw, every
  // match read as "country differs".
  const candidateCountry = candidate.country?.trim() ? toKoreanCountryName(candidate.country).toLowerCase() : undefined;
  const existingCountry = existing.country?.trim() ? toKoreanCountryName(existing.country).toLowerCase() : undefined;
  const candidateSku = candidate.sku?.trim().toLowerCase();
  const existingSku = existing.sku?.trim().toLowerCase();

  const countryMatches = !!candidateCountry && !!existingCountry && candidateCountry === existingCountry;
  const skuOverlaps =
    !!candidateSku && !!existingSku && (candidateSku.includes(existingSku) || existingSku.includes(candidateSku));

  if (countryMatches && skuOverlaps) {
    return { confidence: "high", reason: "Same country and overlapping SKU category" };
  }
  if (!candidateCountry || !existingCountry || !candidateSku || !existingSku) {
    return { confidence: "low", reason: "Not enough country/SKU data to confirm — needs manual review" };
  }
  return { confidence: "low", reason: "Country or SKU category differs — likely a different brand with a similar name" };
}

function toMatch(
  existing: ExistingRecord,
  matchType: DuplicateMatch["matchType"],
  score: number,
  confidence: "high" | "low",
  reason: string
): DuplicateMatch {
  return {
    source: existing.source,
    brandId: existing.source === "brand" ? existing.id : null,
    candidateId: existing.source === "candidate" ? existing.id : null,
    name: existing.name,
    country: existing.country,
    sku: existing.sku,
    sourceNo: existing.sourceNo,
    matchType,
    score,
    confidence,
    reason,
  };
}

/**
 * Checks a candidate brand against every existing Brand *and* every candidate ever
 * surfaced by a previous sourcing run -- not just Brand. Without the second half of
 * this check, re-running sourcing (or a single run's own multiple discovery buckets)
 * could keep rediscovering and re-inserting the same brand as a "new" candidate
 * forever, since nothing remembered it had already been found and reviewed.
 *
 * Uses the same three-tier approach as the original sourcing prompt: exact match,
 * guarded partial match, then fuzzy match at a 0.84 similarity cutoff. Fetches
 * everything and compares in memory -- fine at this table size (low thousands of
 * rows, each comparison is sub-millisecond).
 */
export async function findDuplicates(candidate: DedupCandidate): Promise<DuplicateMatch[]> {
  const candidateName = normalizeName(candidate.name);
  const candidateDomain = extractDomain(candidate.website) ?? null;

  const [existingBrands, existingCandidates] = await Promise.all([
    db.brand.findMany({
      select: { id: true, name: true, country: true, sku: true, sourceNo: true, websiteDomain: true },
    }),
    db.sourcingCandidate.findMany({ select: { id: true, name: true, country: true, sku: true, website: true } }),
  ]);

  const existingRecords: ExistingRecord[] = [
    ...existingBrands.map((b) => ({
      source: "brand" as const,
      id: b.id,
      name: b.name,
      country: b.country,
      sku: b.sku,
      sourceNo: b.sourceNo,
      domain: b.websiteDomain,
    })),
    ...existingCandidates.map((c) => ({
      source: "candidate" as const,
      id: c.id,
      name: c.name,
      country: c.country,
      sku: c.sku,
      sourceNo: null,
      domain: extractDomain(c.website) ?? null,
    })),
  ];

  const matches: DuplicateMatch[] = [];

  for (const existing of existingRecords) {
    const existingName = normalizeName(existing.name);

    if (existingName === candidateName) {
      matches.push(
        toMatch(
          existing,
          "exact",
          1,
          "high",
          existing.source === "brand" ? "Exact name match" : "Exact name match against a previously found sourcing candidate"
        )
      );
      continue;
    }

    // Same website domain = same company even under a different display name (e.g. a
    // rebrand, or one side using a legal suffix/subsidiary name) -- a strong enough
    // signal to auto-exclude on its own, same as an exact name match.
    if (candidateDomain && existing.domain && candidateDomain === existing.domain && !isSharedHost(candidateDomain)) {
      matches.push(
        toMatch(
          existing,
          "domain",
          1,
          "high",
          existing.source === "brand"
            ? "Same website domain as an existing brand"
            : "Same website domain as a previously found sourcing candidate"
        )
      );
      continue;
    }

    // Same name once the business-type words are gone = same brand -- unless both rows
    // name a country and they differ (a "Chocolaterie Morin" in France and a "Confiserie
    // Morin" in Canada are two family businesses).
    const core = coreName(candidateName);
    if (core.length >= 4 && core === coreName(existingName)) {
      // Same language on both sides: the engine sends "France", Brand rows say "프랑스".
      const a = candidate.country?.trim() ? toKoreanCountryName(candidate.country) : null;
      const b = existing.country?.trim() ? toKoreanCountryName(existing.country) : null;
      if (!a || !b || a === b) {
        matches.push(
          toMatch(existing, "partial", 0.95, "high", "Same name apart from a business-type word (Chocolaterie, Company...)")
        );
        continue;
      }
    }

    if (isGuardedPartialMatch(candidateName, existingName)) {
      const { confidence, reason } = crossCheckConfidence(candidate, existing);
      matches.push(toMatch(existing, "partial", 0.9, confidence, reason));
      continue;
    }

    // Similar in full AND without the business-type words: in full, "Chocolaterie Monbana"
    // and "Chocolaterie Morin" scored above the cutoff on the shared "Chocolaterie" alone.
    // The shorter names alone are not enough either ("bordier" ~ "border", "sweeto" ~ "sweet").
    const existingCore = coreName(existingName);
    const fullScore = similarityRatio(candidateName, existingName);
    const score = core && existingCore ? Math.min(fullScore, similarityRatio(core, existingCore)) : fullScore;
    if (score >= FUZZY_CUTOFF) {
      const { confidence, reason } = crossCheckConfidence(candidate, existing);
      matches.push(toMatch(existing, "fuzzy", score, confidence, reason));
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}
