import type { Client } from "@microsoft/microsoft-graph-client";

/**
 * Encodes a SharePoint/OneDrive sharing URL into the "shareId" format Graph's
 * /shares/{shareId} endpoint expects. Documented at:
 * https://learn.microsoft.com/en-us/graph/api/shares-get
 */
export function encodeSharingUrl(shareUrl: string): string {
  const base64 = Buffer.from(shareUrl, "utf8").toString("base64");
  const urlSafe = base64.replace(/=+$/, "").replace(/\//g, "_").replace(/\+/g, "-");
  return `u!${urlSafe}`;
}

export type ResolvedSharedFile = {
  driveId: string;
  itemId: string;
  name: string;
};

/** Resolves a full sharing URL (as pasted from SharePoint/OneDrive "Copy link") to a driveId + itemId. */
export async function resolveSharedFile(client: Client, shareUrl: string): Promise<ResolvedSharedFile> {
  const shareId = encodeSharingUrl(shareUrl);
  const item = await client.api(`/shares/${shareId}/driveItem`).select("id,name,parentReference").get();

  const driveId = item?.parentReference?.driveId;
  const itemId = item?.id;
  if (!driveId || !itemId) {
    throw new Error("Could not resolve the SharePoint file from the configured sharing URL.");
  }

  return { driveId, itemId, name: item.name ?? "brands.xlsx" };
}
