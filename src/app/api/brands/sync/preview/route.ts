import { ResponseType } from "@microsoft/microsoft-graph-client";
import { db } from "@/lib/db";
import { getGraphClient } from "@/lib/graph/client";
import { resolveSharedFile } from "@/lib/graph/resolve-share";
import { parseBrandImportSheet } from "@/lib/brand-import/parse";
import { diffBrandsAgainstSheet } from "@/lib/brand-sync/diff";

/** Read-only dry run: reports what a merge would do without writing anywhere,
 * so the confirmation dialog can show real counts instead of an unqualified warning. */
export async function GET() {
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

    const dbBrands = await db.brand.findMany({ select: { name: true } });
    const { dbOnly, sheetOnly, matchedCount } = diffBrandsAgainstSheet(dbBrands, parsed.rows);

    return Response.json({
      success: true,
      toAddToSheet: dbOnly.length,
      toAddToDb: sheetOnly.length,
      matched: matchedCount,
    });
  } catch {
    return Response.json(
      { error: "Preview failed -- check that Azure credentials are configured and the app has been granted access to the file." },
      { status: 502 }
    );
  }
}
