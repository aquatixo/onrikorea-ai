"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { extractDomain } from "@/lib/extract-domain";
import type { BrandStatus } from "@prisma/client";
import { requireSection, noAccessMessage } from "@/lib/auth/require-section";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

export async function addSourcingCandidateToBrands(candidateId: string): Promise<{ id: string } | { error: string }> {
  if (!(await requireSection("brandSourcing"))) return { error: await noAccessMessage() };
  const candidate = await db.sourcingCandidate.findUnique({ where: { id: candidateId } });
  if (!candidate) return { error: "Candidate not found." };
  if (candidate.verdict === "reject") return { error: "This candidate was rejected and cannot be added." };

  // Same rule as adding a brand by hand (brands/actions.ts createBrand): no second brand
  // with the same name (case-insensitive) or the same website domain. The DB's own
  // unique([name, websiteDomain]) is case-sensitive and lets two NULL domains through, so
  // a candidate whose brand was entered manually in the meantime used to become a duplicate.
  const domain = extractDomain(candidate.website);
  const existing = await db.brand.findFirst({
    where: {
      OR: [
        { name: { equals: candidate.name.trim(), mode: "insensitive" } },
        ...(domain ? [{ websiteDomain: domain }] : []),
      ],
    },
    select: { name: true },
  });
  if (existing) {
    return { error: getDictionary(await getLocale()).sourcing.alreadyInBrands(existing.name) };
  }

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
        websiteDomain: domain,
        status,
        notes: candidate.reason,
      },
    });
    // The review list now shows every pending SourcingCandidate across every run (not
    // just the latest one), so a candidate has to actually leave the table once it's
    // been decided -- otherwise an added candidate would sit there forever since this
    // never used to delete it (only the explicit "reject" delete path did).
    await db.sourcingCandidate.delete({ where: { id: candidateId } });
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
  if (!(await requireSection("brandSourcing"))) return { error: await noAccessMessage() };
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
  if (!(await requireSection("brandSourcing"))) {
    const message = await noAccessMessage();
    return { addedIds: {}, errors: Object.fromEntries(candidateIds.map((id) => [id, message])) };
  }
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
  if (!(await requireSection("brandSourcing"))) return { deleted: 0 };
  const { count } = await db.sourcingCandidate.deleteMany({ where: { id: { in: candidateIds } } });
  revalidatePath("/brands/sourcing");
  return { deleted: count };
}
