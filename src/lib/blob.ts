import { put, del } from "@vercel/blob";

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
