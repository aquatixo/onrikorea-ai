import { db } from "@/lib/db";
import { getGraphClient } from "@/lib/graph/client";
import { resolveSharedFile } from "@/lib/graph/resolve-share";
import { buildBrandsWorkbook } from "@/lib/brand-export/build-workbook";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

/**
 * One-way push: our Postgres `Brand` table is master, this overwrites the SharePoint
 * file's contents to match it entirely. Callers must download a backup first -- see
 * SyncSharePointDialog, which gates this behind that step in the UI.
 */
export async function POST() {
  const shareUrl = process.env.SHAREPOINT_SYNC_FILE_URL;
  if (!shareUrl) {
    return Response.json({ error: "SHAREPOINT_SYNC_FILE_URL is not configured." }, { status: 500 });
  }

  try {
    const client = getGraphClient();
    const { driveId, itemId } = await resolveSharedFile(client, shareUrl);

    const t = getDictionary(await getLocale());
    const brands = await db.brand.findMany({ orderBy: { sourceNo: "asc" } });
    const buffer = buildBrandsWorkbook(brands, t.exportHeaders);

    await client
      .api(`/drives/${driveId}/items/${itemId}/content`)
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .put(buffer);

    return Response.json({ success: true, count: brands.length });
  } catch {
    return Response.json(
      { error: "Sync failed -- check that Azure credentials are configured and the app has been granted access to the file." },
      { status: 502 }
    );
  }
}
