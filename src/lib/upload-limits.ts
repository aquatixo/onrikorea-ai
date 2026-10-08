/**
 * Largest upload the app accepts in one save: a single work attachment, or all the photos
 * picked in one go together. Vercel rejects any request body over ~4.5MB before our code
 * even runs (with an unreadable error), and each byte lands in paid Blob storage -- 4MB
 * keeps every save under that ceiling with room for the other form fields.
 * Photos are shrunk in the browser first (lib/compress-image.ts), so they rarely get close.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export function totalBytes(files: File[]): number {
  return files.reduce((sum, f) => sum + f.size, 0);
}
