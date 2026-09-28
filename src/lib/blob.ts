import { put, del } from "@vercel/blob";

// Blocks types that could execute as active content if someone opens the public blob
// URL directly -- an SVG or HTML file uploaded as an "attachment"/"photo" would otherwise
// get stored with access: "public" and served back as whatever content-type it claims.
const DISALLOWED_ATTACHMENT_TYPES = new Set([
  "text/html",
  "application/xhtml+xml",
  "image/svg+xml",
  "text/javascript",
  "application/javascript",
]);

/** General work-item attachments (PDFs, docs, spreadsheets, images, ...) -- just blocks active-content types. */
export function isAllowedAttachmentType(file: File): boolean {
  return !DISALLOWED_ATTACHMENT_TYPES.has(file.type);
}

/** Field/store/product photos are meant to be real images -- the client's accept="image/*" is trivially
 * bypassed, so this is the actual enforcement. SVG is excluded even though it's an image/* type. */
export function isAllowedImageType(file: File): boolean {
  return file.type.startsWith("image/") && file.type !== "image/svg+xml";
}

/** Uploads a work-item attachment to Vercel Blob. Requires BLOB_READ_WRITE_TOKEN to be set. */
export async function uploadWorkAttachment(file: File): Promise<{ url: string; fileName: string }> {
  const blob = await put(`work-attachments/${crypto.randomUUID()}-${file.name}`, file, {
    access: "public",
    addRandomSuffix: false,
  });
  return { url: blob.url, fileName: file.name };
}

export async function deleteWorkAttachment(url: string): Promise<void> {
  try {
    await del(url);
  } catch {
    // Non-fatal -- the DB reference is what matters; an orphaned blob isn't worth failing the request over.
  }
}

/** Uploads a Field/Store Visit photo to Vercel Blob. Requires BLOB_READ_WRITE_TOKEN to be set. */
export async function uploadFieldPhoto(file: File): Promise<{ url: string; fileName: string }> {
  const blob = await put(`field-photos/${crypto.randomUUID()}-${file.name}`, file, {
    access: "public",
    addRandomSuffix: false,
  });
  return { url: blob.url, fileName: file.name };
}

export async function deleteFieldPhoto(url: string): Promise<void> {
  try {
    await del(url);
  } catch {
    // Non-fatal -- the DB reference is what matters; an orphaned blob isn't worth failing the request over.
  }
}
