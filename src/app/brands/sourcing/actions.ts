"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { discoverCandidates } from "@/lib/brand-sourcing/discover";
import { evaluateCandidate } from "@/lib/brand-sourcing/evaluate";
import { extractDomain } from "@/lib/extract-domain";
import { findUnsafeTextReason } from "@/lib/security/sanitize-input";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import type { BrandStatus } from "@prisma/client";

const VERDICT_RANK = { pass: 0, flag: 1, reject: 2 } as const;

function worseVerdict(a: "pass" | "flag" | "reject", b: "pass" | "flag" | "reject") {
  return VERDICT_RANK[a] >= VERDICT_RANK[b] ? a : b;
}

export async function runBrandSourcing(): Promise<{ error?: string }> {
  let discovered: Awaited<ReturnType<typeof discoverCandidates>>;
  try {
    discovered = await discoverCandidates();
  } catch {
    const t = getDictionary(await getLocale());
    return { error: t.sourcing.runError };
  }

  const run = await db.sourcingRun.create({ data: {} });

  await db.sourcingCandidate.createMany({
    data: await Promise.all(
      discovered.map(async (candidate) => {
        // Discovered candidates carry text pulled from arbitrary websites via web search --
        // treat them as untrusted input same as a file upload, not just LLM-summarized text.
        const untrustedFields = [candidate.name, candidate.country, candidate.sku, candidate.website, candidate.webReason];
        const isUnsafe = untrustedFields.some((v) => v != null && findUnsafeTextReason(v) !== null);
        if (isUnsafe) {
          return {
            runId: run.id,
            name: "[blocked candidate]",
            methodology: candidate.methodology,
            country: null,
            sku: null,
            foundedYear: null,
            website: null,
            verdict: "reject" as const,
            reason: "Blocked: unsafe content detected in AI web-search results for this candidate.",
            evidence: [],
          };
        }

        const evaluation = await evaluateCandidate({
          name: candidate.name,
          country: candidate.country,
          sku: candidate.sku,
          foundedYear: candidate.foundedYear,
          website: candidate.website,
          methodology: candidate.methodology,
        });

        const verdict = worseVerdict(candidate.webVerdict, evaluation.verdict);

        const reasonParts = [candidate.webReason];
        if (evaluation.categoryExcluded.excluded) reasonParts.push(evaluation.categoryExcluded.reason!);
        if (evaluation.duplicates.length > 0) {
          reasonParts.push(
            `Possible duplicate of existing brand: ${evaluation.duplicates[0].name} (${evaluation.duplicates[0].reason})`
          );
        }

        return {
          runId: run.id,
          name: candidate.name,
          methodology: candidate.methodology,
          country: evaluation.normalized.country,
          sku: evaluation.normalized.sku,
          foundedYear: evaluation.normalized.foundedYear,
          website: candidate.website,
          verdict,
          reason: reasonParts.join(" | "),
          evidence: candidate.evidence,
        };
      })
    ),
  });

  revalidatePath("/brands/sourcing");
  return {};
}

export async function addSourcingCandidateToBrands(candidateId: string): Promise<{ id: string } | { error: string }> {
  const candidate = await db.sourcingCandidate.findUnique({ where: { id: candidateId } });
  if (!candidate) return { error: "Candidate not found." };
  if (candidate.verdict === "reject") return { error: "This candidate was rejected and cannot be added." };

  const status: BrandStatus = candidate.verdict === "pass" ? "APPROVED" : "SCREENING";

  try {
    const brand = await db.brand.create({
      data: {
        name: candidate.name,
        methodology: candidate.methodology ?? undefined,
        country: candidate.country ?? undefined,
        sku: candidate.sku ?? undefined,
        foundedYear: candidate.foundedYear ?? undefined,
        website: candidate.website ?? undefined,
        websiteDomain: extractDomain(candidate.website),
        status,
        notes: candidate.reason,
      },
    });
    revalidatePath("/brands/sourcing");
    return { id: brand.id };
  } catch {
    return { error: "Failed to save — a brand with this name may already exist." };
  }
}
