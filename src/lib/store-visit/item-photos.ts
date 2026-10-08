import { db } from "@/lib/db";
import { uploadFieldPhoto, isAllowedImageType } from "@/lib/blob";
import { StoreVisitPhotoType } from "@prisma/client";
import { MAX_UPLOAD_BYTES } from "@/lib/upload-limits";

/** The real image files in a form's "photos" input (empty slots, non-images, and anything
 * over the upload limit dropped -- the forms already stop oversized photos in the browser). */
export async function getPhotoFiles(formData: FormData): Promise<File[]> {
  const files = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0 && f.size <= MAX_UPLOAD_BYTES);
  const real = await Promise.all(files.map((f) => isAllowedImageType(f)));
  return files.filter((_, i) => real[i]);
}

/**
 * Uploads the form's photos and attaches them to one product (a store-visit item). Shared by
 * the store-visit item form and the Products page, which edit the same Product rows -- the
 * Products page used to show the photo picker but never saved what was picked.
 *
 * Lives outside the "use server" action files on purpose: every export there becomes a
 * callable endpoint, and this must only run after the caller's own permission checks.
 */
export async function attachItemPhotos(
  formData: FormData,
  storeVisitId: string,
  itemId: string,
  createdById: string | undefined
): Promise<void> {
  const files = await getPhotoFiles(formData);
  if (files.length === 0) return;
  const requested = formData.get("photoType");
  const photoType = Object.values(StoreVisitPhotoType).includes(requested as StoreVisitPhotoType)
    ? (requested as StoreVisitPhotoType)
    : StoreVisitPhotoType.PRODUCT;
  const uploaded = await Promise.all(files.map((f) => uploadFieldPhoto(f)));
  await db.storeVisitPhoto.createMany({
    data: uploaded.map((u) => ({
      storeVisitId,
      storeVisitItemId: itemId,
      photoType,
      fileUrl: u.url,
      fileName: u.fileName,
      createdById,
    })),
  });
}
