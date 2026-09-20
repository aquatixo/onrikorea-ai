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
          const d = evaluation.duplicates[0];
          const label = d.source === "brand" ? "existing brand" : "a previously found sourcing candidate";
          reasonParts.push(`Possible duplicate of ${label}: ${d.name} (${d.reason})`);
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
    // sourceNo is the running "No" column everyone actually reads down the Brands list --
    // a brand added from sourcing needs the next number in that same sequence, not a blank.
    const { _max } = await db.brand.aggregate({ _max: { sourceNo: true } });
    const sourceNo = (_max.sourceNo ?? 0) + 1;

    const brand = await db.brand.create({
      data: {
        sourceNo,
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

/** Removes a candidate from the sourcing results -- for junk the name filter let
 * through (listicles, FAQ pages, etc.) that a human doesn't want cluttering the review
 * list. Doesn't touch Brands; this only ever deletes a SourcingCandidate row. */
export async function deleteSourcingCandidate(candidateId: string): Promise<{ ok: true } | { error: string }> {
  try {
    await db.sourcingCandidate.delete({ where: { id: candidateId } });
    revalidatePath("/brands/sourcing");
    return { ok: true };
  } catch {
    return { error: "Failed to delete candidate." };
  }
}

/** Bulk version of addSourcingCandidateToBrands for the "전체 추가" toolbar action --
 * runs sequentially (not Promise.all) so each candidate's sourceNo aggregate sees the
 * previous insert, same as adding them one at a time from the UI. */
export async function addSourcingCandidatesToBrands(
  candidateIds: string[]
): Promise<{ addedIds: Record<string, string>; errors: Record<string, string> }> {
  const addedIds: Record<string, string> = {};
  const errors: Record<string, string> = {};

  for (const id of candidateIds) {
    const result = await addSourcingCandidateToBrands(id);
    if ("error" in result) errors[id] = result.error;
    else addedIds[id] = result.id;
  }

  return { addedIds, errors };
}

/** Bulk version of deleteSourcingCandidate for the "전체 삭제" toolbar action. */
export async function deleteSourcingCandidates(candidateIds: string[]): Promise<{ deleted: number }> {
  const { count } = await db.sourcingCandidate.deleteMany({ where: { id: { in: candidateIds } } });
  revalidatePath("/brands/sourcing");
  return { deleted: count };
}
