import { db } from "@/lib/db";
import { similarityRatio } from "@/lib/brand-sourcing/similarity";

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
  matchType: "exact" | "partial" | "fuzzy";
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
};

export type DedupCandidate = {
  name: string;
  country?: string | null;
  sku?: string | null;
};

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
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
  const candidateCountry = candidate.country?.trim().toLowerCase();
  const existingCountry = existing.country?.trim().toLowerCase();
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

  const [existingBrands, existingCandidates] = await Promise.all([
    db.brand.findMany({ select: { id: true, name: true, country: true, sku: true, sourceNo: true } }),
    db.sourcingCandidate.findMany({ select: { id: true, name: true, country: true, sku: true } }),
  ]);

  const existingRecords: ExistingRecord[] = [
    ...existingBrands.map((b) => ({ source: "brand" as const, ...b })),
    ...existingCandidates.map((c) => ({ source: "candidate" as const, ...c, sourceNo: null })),
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

    if (isGuardedPartialMatch(candidateName, existingName)) {
      const { confidence, reason } = crossCheckConfidence(candidate, existing);
      matches.push(toMatch(existing, "partial", 0.9, confidence, reason));
      continue;
    }

    const score = similarityRatio(candidateName, existingName);
    if (score >= FUZZY_CUTOFF) {
      const { confidence, reason } = crossCheckConfidence(candidate, existing);
      matches.push(toMatch(existing, "fuzzy", score, confidence, reason));
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}
