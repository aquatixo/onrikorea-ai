import { generateText, Output, stepCountIs } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { DISCOVERY_BUCKETS, type DiscoveryBucket } from "@/lib/brand-sourcing/discovery-buckets";
import { similarityRatio } from "@/lib/brand-sourcing/similarity";

const HARD_CRITERIA = `
Hard requirements for every candidate:
- Must NOT currently be sold in Korea through any channel (retail, e-commerce, distributor) — check this explicitly.
- Must NOT be confirmed as owned by a large multinational conglomerate (e.g. Nestlé, Mondelez, Unilever, PepsiCo, Danone, General Mills, Kraft Heinz, etc.) — if ownership is unclear, say so rather than guessing.
- Must have a real, verifiable official website.
- Prefer brands with a heritage story: founded before 1980, family-owned or independently owned, multi-generational.
- Must be a complete consumer product ready for retail, not a raw commodity or OEM/private-label-only supplier.
- Packaging should be presentable for retail (avoid brands with clearly outdated or purely industrial/bulk packaging where you can tell from product photos).
`.trim();

const RawCandidateSchema = z.object({
  name: z.string().describe("Brand name"),
  country: z.string().nullable().describe("Country of origin, no city/region"),
  website: z.string().nullable().describe("Official website URL"),
  foundedYear: z.number().nullable().describe("Year founded, if known"),
  sku: z.string().describe("Short product category description, e.g. 'Heritage savory crackers'"),
  heritageNote: z.string().describe("1-2 sentences: heritage story and ownership structure evidence found"),
});

export type RawCandidate = z.infer<typeof RawCandidateSchema> & { methodology: string };

const BucketResultSchema = z.object({
  candidates: z.array(RawCandidateSchema),
});

async function runDiscoveryBucket(bucket: DiscoveryBucket): Promise<RawCandidate[]> {
  const result = await generateText({
    model: anthropic("claude-sonnet-5"),
    tools: {
      web_search: anthropic.tools.webSearch_20260209({ maxUses: 8 }),
    },
    stopWhen: stepCountIs(8),
    output: Output.object({ schema: BucketResultSchema }),
    prompt: `You are sourcing NEW heritage brand candidates for a Korean distributor.

Category focus for this search: ${bucket.brief}

${HARD_CRITERIA}

Search the web to find 6-10 real, currently-operating brands matching this category and criteria. Do not invent brands — only return brands you found real evidence for during search. For each, give your best-effort country, founded year, and a short heritageNote citing what you found about its ownership/history.`,
  });

  const candidates = result.output?.candidates ?? [];
  return candidates.map((c) => ({ ...c, methodology: bucket.label }));
}

/**
 * Drops near-duplicate candidates surfaced by more than one bucket (e.g. a chocolate
 * brand that also markets a snack line) before spending verification budget on them twice.
 * Reuses the same 0.84 fuzzy cutoff as the DB-side dedup engine for consistency.
 */
function dedupePooled(candidates: RawCandidate[]): RawCandidate[] {
  const kept: RawCandidate[] = [];
  for (const candidate of candidates) {
    const name = candidate.name.trim().toLowerCase();
    const isDuplicate = kept.some((k) => similarityRatio(name, k.name.trim().toLowerCase()) >= 0.84);
    if (!isDuplicate) kept.push(candidate);
  }
  return kept;
}

const VerificationSchema = z.object({
  results: z.array(
    z.object({
      name: z.string().describe("Must exactly match the candidate name it corresponds to"),
      verdict: z.enum(["pass", "flag", "reject"]),
      reason: z.string().describe("Concise explanation of the verdict, citing what was verified"),
      evidence: z.array(z.string()).describe("Source URLs used to verify this candidate"),
    })
  ),
});

export type VerificationResult = z.infer<typeof VerificationSchema>["results"][number];

async function verifyCandidates(candidates: RawCandidate[]): Promise<VerificationResult[]> {
  if (candidates.length === 0) return [];

  const listing = candidates
    .map((c, i) => `${i + 1}. ${c.name} — country: ${c.country ?? "unknown"}, founded: ${c.foundedYear ?? "unknown"}, category: ${c.sku}. Notes: ${c.heritageNote}`)
    .join("\n");

  const result = await generateText({
    model: anthropic("claude-opus-5"),
    tools: {
      web_search: anthropic.tools.webSearch_20260209({ maxUses: 30 }),
    },
    stopWhen: stepCountIs(30),
    output: Output.object({ schema: VerificationSchema }),
    prompt: `Verify each brand candidate below against these hard requirements before it's added to a sourcing pipeline:

${HARD_CRITERIA}

For EACH candidate, search the web as needed to check specifically:
(a) whether it is currently sold in Korea through any channel,
(b) its ownership structure (independent/family-owned vs. multinational-owned),
(c) whether its heritage story (pre-1980, family-owned) holds up.

Verdict rules:
- "reject": confirmed sold in Korea, OR confirmed owned by a large multinational, OR you cannot find a real official website.
- "flag": any of the above is ambiguous/unverifiable, or evidence is thin — needs human review.
- "pass": no Korea distribution found, independent/family ownership confirmed or plausible, heritage story checks out.

Candidates:
${listing}

Return one result per candidate, with the "name" field matching exactly.`,
  });

  return result.output?.results ?? [];
}

export type DiscoveredCandidate = RawCandidate & {
  webVerdict: "pass" | "flag" | "reject";
  webReason: string;
  evidence: string[];
};

/** Runs the full fan-out (one call per bucket) + single verification pass. */
export async function discoverCandidates(): Promise<DiscoveredCandidate[]> {
  const bucketResults = await Promise.all(DISCOVERY_BUCKETS.map(runDiscoveryBucket));
  const pooled = dedupePooled(bucketResults.flat());
  const verifications = await verifyCandidates(pooled);

  return pooled.map((candidate) => {
    const verification = verifications.find(
      (v) => v.name.trim().toLowerCase() === candidate.name.trim().toLowerCase()
    );
    return {
      ...candidate,
      webVerdict: verification?.verdict ?? "flag",
      webReason: verification?.reason ?? "Verification pass did not return a result for this candidate — needs manual review.",
      evidence: verification?.evidence ?? [],
    };
  });
}
