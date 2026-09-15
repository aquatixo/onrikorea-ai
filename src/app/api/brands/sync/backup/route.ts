import { ResponseType } from "@microsoft/microsoft-graph-client";
import { getGraphClient } from "@/lib/graph/client";
import { resolveSharedFile } from "@/lib/graph/resolve-share";

/** Downloads the CURRENT SharePoint file as-is, unchanged -- used as a backup before /push overwrites it. */
export async function GET() {
  const shareUrl = process.env.SHAREPOINT_SYNC_FILE_URL;
  if (!shareUrl) {
    return Response.json({ error: "SHAREPOINT_SYNC_FILE_URL is not configured." }, { status: 500 });
  }

  try {
    const client = getGraphClient();
    const { driveId, itemId, name } = await resolveSharedFile(client, shareUrl);
    const buffer: ArrayBuffer = await client
      .api(`/drives/${driveId}/items/${itemId}/content`)
      .responseType(ResponseType.ARRAYBUFFER)
      .get();

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}"`,
      },
    });
  } catch {
    return Response.json({ error: "Could not download the current file from SharePoint." }, { status: 502 });
  }
}
