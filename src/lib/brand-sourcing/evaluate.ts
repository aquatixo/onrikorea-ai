import { findDuplicates, type DuplicateMatch } from "@/lib/brand-sourcing/dedup";
import { evaluateCategory, type CategoryVerdict } from "@/lib/brand-sourcing/category-filter";
import { normalizeCandidateFields, type NormalizedCandidate } from "@/lib/brand-sourcing/normalize";

export type CandidateInput = {
  name: string;
  country?: string | null;
  sku?: string | null;
  foundedYear?: string | number | null;
  website?: string | null;
  methodology?: string | null;
  channel?: string | null;
  contactPoint?: string | null;
};

export type EvaluationResult = {
  verdict: "reject" | "flag" | "pass";
  duplicates: DuplicateMatch[];
  categoryExcluded: CategoryVerdict;
  normalized: NormalizedCandidate;
};

/**
 * Single entry point for validating a sourced brand candidate before it's inserted.
 * Callable from anywhere -- a TS script inside this project, or externally (Python,
 * Claude, whatever ends up doing the actual sourcing) via the /api/brands/evaluate-candidate
 * route, which just wraps this function.
 */
export async function evaluateCandidate(candidate: CandidateInput): Promise<EvaluationResult> {
  const normalized = normalizeCandidateFields(candidate);
  const categoryExcluded = evaluateCategory(normalized.sku);
  const duplicates = await findDuplicates({
    name: candidate.name,
    country: normalized.country,
    sku: normalized.sku,
  });

  let verdict: EvaluationResult["verdict"] = "pass";
  if (categoryExcluded.excluded) {
    verdict = "reject";
  } else if (duplicates.some((d) => d.matchType === "exact" || d.confidence === "high")) {
    verdict = "reject";
  } else if (duplicates.length > 0) {
    verdict = "flag";
  }

  return { verdict, duplicates, categoryExcluded, normalized };
}
