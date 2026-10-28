"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { nextSourceNo } from "@/lib/brand-source-no";
import { extractDomain } from "@/lib/extract-domain";
import type { BrandStatus } from "@prisma/client";
import { requireSection, noAccessMessage } from "@/lib/auth/require-section";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

export async function addSourcingCandidateToBrands(candidateId: string): Promise<{ id: string } | { error: string }> {
  const session = await requireSection("brandSourcing");
  if (!session) return { error: await noAccessMessage() };
  const t = getDictionary(await getLocale()).sourcing;
  const candidate = await db.sourcingCandidate.findUnique({ where: { id: candidateId } });
  if (!candidate || candidate.hiddenAt) return { error: t.candidateNotFound };
  if (candidate.verdict === "reject") return { error: t.candidateRejected };

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
    return { error: t.alreadyInBrands(existing.name) };
  }

  const status: BrandStatus = candidate.verdict === "pass" ? "APPROVED" : "SCREENING";

  try {
    const sourceNo = await nextSourceNo();

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
        // Owner = whoever added it, same as a brand created by hand -- without it only an
        // ADMIN could edit or delete it afterwards (src/lib/auth/ownership.ts).
        createdById: session.user?.id,
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
    return { error: t.addFailed };
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

/** "후보 삭제": hides the selected candidates instead of deleting them -- the kept row is
 * what stops the next run from finding the same site again (see SourcingCandidate.hiddenAt).
 * Doesn't touch Brands. */
export async function deleteSourcingCandidates(candidateIds: string[]): Promise<{ deleted: number }> {
  if (!(await requireSection("brandSourcing"))) return { deleted: 0 };
  const { count } = await db.sourcingCandidate.updateMany({
    where: { id: { in: candidateIds }, hiddenAt: null },
    data: { hiddenAt: new Date() },
  });
  revalidatePath("/brands/sourcing");
  revalidatePath("/brands/sourcing/hidden");
  return { deleted: count };
}

/** "복원": puts hidden candidates back on the review list. */
export async function restoreSourcingCandidates(candidateIds: string[]): Promise<{ restored: number }> {
  if (!(await requireSection("brandSourcing"))) return { restored: 0 };
  const { count } = await db.sourcingCandidate.updateMany({
    where: { id: { in: candidateIds }, hiddenAt: { not: null } },
    data: { hiddenAt: null },
  });
  revalidatePath("/brands/sourcing");
  revalidatePath("/brands/sourcing/hidden");
  return { restored: count };
}
