"use client";

/**
 * Resizes + re-encodes an image before upload so a 10MB+ phone-camera photo doesn't get
 * stored as-is. Caps the longest side at 1600px and re-encodes as JPEG -- plenty of detail
 * for reviewing a shelf/price-tag photo later, at a fraction of the storage size. Runs in
 * the browser via Canvas, no extra dependency needed.
 */
export async function compressImage(file: File, opts?: { maxDimension?: number; quality?: number }): Promise<File> {
  const maxDimension = opts?.maxDimension ?? 1600;
  const quality = opts?.quality ?? 0.8;

  // Leave non-images (and animated GIFs, which canvas would flatten to one frame) alone.
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file; // keep the original if re-encoding didn't actually shrink it

    const newName = file.name.replace(/\.\w+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg" });
  } catch {
    return file; // any failure (unsupported format, decode error) -- just upload the original
  }
}

export async function compressImages(files: File[], opts?: { maxDimension?: number; quality?: number }): Promise<File[]> {
  return Promise.all(files.map((f) => compressImage(f, opts)));
}
