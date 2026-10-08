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

type ImageKind = { mime: string; ext: string };

function startsWith(bytes: Uint8Array, sig: number[], offset = 0): boolean {
  return sig.every((b, i) => bytes[offset + i] === b);
}

/**
 * The image type a file actually IS, read from its first bytes. The browser-reported
 * file.type and the file name are both chosen by the uploader -- an HTML file labelled
 * image/png and named x.png would otherwise be stored and served as a web page.
 */
export async function detectImageType(file: File): Promise<ImageKind | null> {
  const b = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (startsWith(b, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpg" };
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: "image/png", ext: "png" };
  if (startsWith(b, [0x47, 0x49, 0x46, 0x38])) return { mime: "image/gif", ext: "gif" };
  if (startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8)) return { mime: "image/webp", ext: "webp" };
  if (startsWith(b, [0x66, 0x74, 0x79, 0x70], 4)) {
    const brand = String.fromCharCode(...b.slice(8, 12));
    if (brand === "avif" || brand === "avis") return { mime: "image/avif", ext: "avif" };
    if (["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand)) return { mime: "image/heic", ext: "heic" };
  }
  return null;
}

/** Field/store/product photos must really be images (see detectImageType); SVG is never accepted. */
export async function isAllowedImageType(file: File): Promise<boolean> {
  return (await detectImageType(file)) !== null;
}

// Attachment content types are set from this list, never from the uploader. Anything not
// listed is stored as application/octet-stream, which browsers download instead of render.
const ATTACHMENT_TYPES_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  hwp: "application/x-hwp",
  zip: "application/zip",
};

async function attachmentContentType(file: File): Promise<string> {
  const image = await detectImageType(file);
  if (image) return image.mime;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return ATTACHMENT_TYPES_BY_EXT[ext] ?? "application/octet-stream";
}

/** Uploads a work-item attachment to Vercel Blob. Requires BLOB_READ_WRITE_TOKEN to be set. */
export async function uploadWorkAttachment(file: File): Promise<{ url: string; fileName: string }> {
  const blob = await put(`work-attachments/${crypto.randomUUID()}-${file.name}`, file, {
    access: "public",
    addRandomSuffix: false,
    contentType: await attachmentContentType(file),
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

/**
 * Uploads a Field/Store Visit photo to Vercel Blob. Requires BLOB_READ_WRITE_TOKEN to be set.
 * Callers filter with isAllowedImageType first; this re-checks and stores under the
 * detected type and extension, so the uploader's name and claimed type are never trusted.
 */
export async function uploadFieldPhoto(file: File): Promise<{ url: string; fileName: string }> {
  const kind = await detectImageType(file);
  if (!kind) throw new Error("Not an image file.");
  const blob = await put(`field-photos/${crypto.randomUUID()}.${kind.ext}`, file, {
    access: "public",
    addRandomSuffix: false,
    contentType: kind.mime,
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
