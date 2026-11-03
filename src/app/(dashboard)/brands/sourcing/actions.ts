"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { nextSourceNo } from "@/lib/brand-source-no";
import { extractDomain } from "@/lib/extract-domain";
import type { BrandStatus } from "@prisma/client";
import { requireSection, noAccessMessage } from "@/lib/auth/require-section";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { formatImportError, parseBrandImportSheet } from "@/lib/brand-import/parse";
import { matchDomain, normalizeName } from "@/lib/brand-sourcing/dedup";
import { MAX_UPLOAD_BYTES } from "@/lib/upload-limits";
import type { ImportResult } from "@/app/(dashboard)/brands/import-actions";

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

// The 판정 column as the export writes it ("flag") or as someone retyped it ("검토", "Flag").
const VERDICTS: Record<string, string> = {
  pass: "pass", flag: "flag", reject: "reject",
  통과: "pass", 검토: "flag", 거절: "reject",
};

/** "데이터 삽입 (엑셀)" on the deleted list: the rows become deleted candidates, so the
 * duplicate check (dedup.ts reads every candidate row) keeps sourcing from finding those
 * brands again -- e.g. a list the team already turned down outside the app. Same columns
 * as the Excel download. A row matching a deleted candidate is skipped; one matching a
 * candidate still on the review list hides that candidate instead of adding a second row. */
export async function importHiddenCandidatesFromExcel(formData: FormData): Promise<ImportResult> {
  if (!(await requireSection("brandSourcing"))) return { success: false, errors: [await noAccessMessage()] };
  const t = getDictionary(await getLocale());

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { success: false, errors: [t.brandImport.noFileChosen] };
  if (file.size > MAX_UPLOAD_BYTES) return { success: false, errors: [t.common.fileTooLarge] };

  const parsed = parseBrandImportSheet(Buffer.from(await file.arrayBuffer()));
  if (!parsed.ok) return { success: false, errors: parsed.errors.map((e) => formatImportError(e, t)) };

  // Same name/website matching as the duplicate check (dedup.ts).
  const existing = await db.sourcingCandidate.findMany({ select: { id: true, name: true, website: true, hiddenAt: true } });
  const byName = new Map<string, (typeof existing)[number]>();
  const byDomain = new Map<string, (typeof existing)[number]>();
  for (const c of existing) {
    byName.set(normalizeName(c.name), c);
    const domain = matchDomain(c.website);
    if (domain) byDomain.set(domain, c);
  }

  const seen = new Set<string>();
  const toHide = new Set<string>();
  const toCreate: (typeof parsed.rows)[number][] = [];
  let skipped = 0;
  for (const row of parsed.rows) {
    const nameKey = normalizeName(row.name);
    const domain = matchDomain(row.website);
    if (seen.has(`n:${nameKey}`) || (domain && seen.has(`d:${domain}`))) {
      skipped++;
      continue;
    }
    seen.add(`n:${nameKey}`);
    if (domain) seen.add(`d:${domain}`);

    const match = byName.get(nameKey) ?? (domain ? byDomain.get(domain) : undefined);
    if (!match) toCreate.push(row);
    else if (match.hiddenAt) skipped++;
    else toHide.add(match.id);
  }

  const now = new Date();
  try {
    await db.$transaction([
      ...(toCreate.length
        ? [
            // Its own run, so these rows are told apart from what a search run found.
            // Run lists read by backend ("serper"/"tavily"), so this one never shows there.
            db.sourcingRun.create({
              data: {
                status: "done",
                backend: "excel",
                candidates: {
                  createMany: {
                    data: toCreate.map((row) => ({
                      name: row.name,
                      methodology: row.methodology,
                      country: row.country,
                      sku: row.sku,
                      foundedYear: row.foundedYear,
                      website: row.website,
                      verdict: VERDICTS[row.verdict?.toLowerCase() ?? ""] ?? "flag",
                      reason: row.notes ?? t.sourcing.importedReason,
                      evidence: [],
                      hiddenAt: now,
                    })),
                  },
                },
              },
            }),
          ]
        : []),
      db.sourcingCandidate.updateMany({ where: { id: { in: [...toHide] }, hiddenAt: null }, data: { hiddenAt: now } }),
    ]);
  } catch {
    return { success: false, errors: [t.brandImport.importFailed] };
  }

  revalidatePath("/brands/sourcing");
  revalidatePath("/brands/sourcing/hidden");
  return {
    success: true,
    count: toCreate.length,
    message: t.sourcing.importHiddenSummary(toCreate.length, toHide.size, skipped),
  };
}
