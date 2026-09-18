"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { extractDomain } from "@/lib/extract-domain";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { parseBrandImportSheet, type ImportError } from "@/lib/brand-import/parse";

export type ImportResult = { success: true; count: number } | { success: false; errors: string[] };

function formatError(error: ImportError, t: ReturnType<typeof getDictionary>): string {
  switch (error.code) {
    case "unreadableFile":
      return t.brandImport.unreadableFile;
    case "noSheets":
      return t.brandImport.noSheets;
    case "noDataRows":
      return t.brandImport.noDataRows;
    case "noFileChosen":
      return t.brandImport.noFileChosen;
    case "importFailed":
      return t.brandImport.importFailed;
    case "nameRequired":
      return t.brandImport.rowNameRequired(error.row);
    case "invalidYear":
      return t.brandImport.rowInvalidYear(error.row);
    case "duplicateNameInFile":
      return t.brandImport.rowDuplicateNameInFile(error.row, error.name);
    case "duplicateWebsiteInFile":
      return t.brandImport.rowDuplicateWebsiteInFile(error.row, error.website);
    case "nameExists":
      return t.brandImport.rowNameExists(error.row, error.name);
    case "websiteExists":
      return t.brandImport.rowWebsiteExists(error.row, error.website);
    case "unsafeContent":
      return t.brandImport.rowUnsafeContent(error.row, error.field);
  }
}

export async function importBrandsFromExcel(formData: FormData): Promise<ImportResult> {
  const t = getDictionary(await getLocale());

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, errors: [t.brandImport.noFileChosen] };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = parseBrandImportSheet(buffer);
  if (!parsed.ok) {
    return { success: false, errors: parsed.errors.map((e) => formatError(e, t)) };
  }

  const existing = await db.brand.findMany({ select: { name: true, websiteDomain: true, sourceNo: true } });
  const existingNames = new Set(existing.map((b) => b.name.trim().toLowerCase()));
  const existingDomains = new Set(
    existing.map((b) => b.websiteDomain).filter((d): d is string => !!d)
  );
  let nextSourceNo = Math.max(0, ...existing.map((b) => b.sourceNo ?? 0)) + 1;

  // Name and website are what actually identify a brand here (see parse.ts) --
  // check both in-file and against the DB, rather than the legacy "no" column.
  const errors: ImportError[] = [];
  const seenNames = new Set<string>();
  const seenDomains = new Set<string>();
  const toCreate: { row: (typeof parsed.rows)[number]; domain: string | undefined; sourceNo: number }[] = [];

  for (const row of parsed.rows) {
    const nameKey = row.name.trim().toLowerCase();
    const domain = extractDomain(row.website);

    if (seenNames.has(nameKey)) {
      errors.push({ scope: "row", row: row.rowNumber, code: "duplicateNameInFile", name: row.name });
      continue;
    }
    if (domain && seenDomains.has(domain)) {
      errors.push({ scope: "row", row: row.rowNumber, code: "duplicateWebsiteInFile", website: row.website! });
      continue;
    }
    if (existingNames.has(nameKey)) {
      errors.push({ scope: "row", row: row.rowNumber, code: "nameExists", name: row.name });
      continue;
    }
    if (domain && existingDomains.has(domain)) {
      errors.push({ scope: "row", row: row.rowNumber, code: "websiteExists", website: row.website! });
      continue;
    }

    seenNames.add(nameKey);
    if (domain) seenDomains.add(domain);
    toCreate.push({ row, domain, sourceNo: nextSourceNo++ });
  }

  if (errors.length > 0) {
    return { success: false, errors: errors.map((e) => formatError(e, t)) };
  }

  try {
    await db.$transaction(
      toCreate.map(({ row, domain, sourceNo }) =>
        db.brand.create({
          data: {
            sourceNo,
            methodology: row.methodology ?? undefined,
            name: row.name,
            country: row.country ?? undefined,
            sku: row.sku ?? undefined,
            foundedYear: row.foundedYear ?? undefined,
            website: row.website ?? undefined,
            websiteDomain: domain,
            contactPoint: row.contactPoint ?? undefined,
            coldEmail: row.coldEmail,
            reply: row.reply,
          },
        })
      )
    );
  } catch {
    return { success: false, errors: [t.brandImport.importFailed] };
  }

  revalidatePath("/brands");
  return { success: true, count: toCreate.length };
}
