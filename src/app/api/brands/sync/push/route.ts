import { ResponseType } from "@microsoft/microsoft-graph-client";
import { db } from "@/lib/db";
import { getGraphClient } from "@/lib/graph/client";
import { resolveSharedFile } from "@/lib/graph/resolve-share";
import { parseBrandImportSheet } from "@/lib/brand-import/parse";
import { buildBrandsWorkbook } from "@/lib/brand-export/build-workbook";
import { diffBrandsAgainstSheet, toBrandCreateInput } from "@/lib/brand-sync/diff";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

/**
 * Two-way merge, not a one-way overwrite: reads the SharePoint sheet's current rows,
 * diffs them against our Brand table by name (see diff.ts), creates whatever's on the
 * sheet but missing from the DB, then rebuilds the sheet from the now-complete DB
 * list. Every brand from either side ends up in both -- see diff.ts's doc comment for
 * what this does NOT do (field-level conflict resolution for brands already on both
 * sides). Callers must download a backup first -- see SyncBrandsDialog.
 */
export async function POST() {
  const shareUrl = process.env.SHAREPOINT_SYNC_FILE_URL;
  if (!shareUrl) {
    return Response.json({ error: "SHAREPOINT_SYNC_FILE_URL is not configured." }, { status: 500 });
  }

  try {
    const client = getGraphClient();
    const { driveId, itemId } = await resolveSharedFile(client, shareUrl);

    const fileBuffer: ArrayBuffer = await client
      .api(`/drives/${driveId}/items/${itemId}/content`)
      .responseType(ResponseType.ARRAYBUFFER)
      .get();
    const parsed = parseBrandImportSheet(Buffer.from(fileBuffer));
    if (!parsed.ok) {
      return Response.json({ error: "Could not read the SharePoint file's current rows." }, { status: 502 });
    }

    const dbBrands = await db.brand.findMany({ orderBy: { sourceNo: "asc" } });
    const { dbOnly, sheetOnly } = diffBrandsAgainstSheet(dbBrands, parsed.rows);

    // Sheet-only rows might repeat a name within the sheet itself (or collide with
    // each other's website domain) -- keep only the first occurrence of each, same
    // guard the manual importer already applies against a single bad file.
    const seenNames = new Set<string>();
    const seenDomains = new Set<string>();
    const toCreate = sheetOnly.filter((row) => {
      const nameKey = row.name.trim().toLowerCase();
      if (seenNames.has(nameKey)) return false;
      seenNames.add(nameKey);
      const domain = row.website?.trim();
      if (domain) {
        if (seenDomains.has(domain)) return false;
        seenDomains.add(domain);
      }
      return true;
    });

    let nextSourceNo = Math.max(0, ...dbBrands.map((b) => b.sourceNo ?? 0)) + 1;
    if (toCreate.length > 0) {
      await db.$transaction(
        toCreate.map((row) => db.brand.create({ data: toBrandCreateInput(row, nextSourceNo++) }))
      );
    }

    const t = getDictionary(await getLocale());
    const fullBrandList = await db.brand.findMany({ orderBy: { sourceNo: "asc" } });
    const buffer = buildBrandsWorkbook(fullBrandList, t.exportHeaders);

    await client
      .api(`/drives/${driveId}/items/${itemId}/content`)
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .put(buffer);

    return Response.json({
      success: true,
      addedToSheet: dbOnly.length,
      addedToDb: toCreate.length,
    });
  } catch {
    return Response.json(
      { error: "Sync failed -- check that Azure credentials are configured and the app has been granted access to the file." },
      { status: 502 }
    );
  }
}
