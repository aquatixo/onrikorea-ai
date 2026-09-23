"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { storeVisitFormSchema, productFormSchema } from "@/lib/validation/field";
import { UNSAFE_INPUT_MESSAGE } from "@/lib/security/sanitize-input";
import { uploadFieldPhoto, deleteFieldPhoto } from "@/lib/blob";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import type { StoreVisitPhotoType, StoreVisitStatus } from "@prisma/client";

export type StoreVisitFormState = {
  errors?: Partial<Record<string, string[]>>;
  message?: string;
};

function localizeVisitErrors(
  fieldErrors: Partial<Record<string, string[]>>,
  t: ReturnType<typeof getDictionary>["field"]
): Partial<Record<string, string[]>> {
  const localized: Partial<Record<string, string[]>> = {};
  for (const [field, messages] of Object.entries(fieldErrors)) {
    if (!messages || messages.length === 0) continue;
    if (messages.includes(UNSAFE_INPUT_MESSAGE)) {
      localized[field] = [t.unsafeContent];
      continue;
    }
    if (field === "storeId") localized[field] = [t.visits.storeRequired];
    if (field === "visitDate") localized[field] = [t.visits.visitDateRequired];
    if (field === "visitor") localized[field] = [t.visits.visitorRequired];
  }
  return localized;
}

export async function createStoreVisit(
  prevState: StoreVisitFormState,
  formData: FormData
): Promise<StoreVisitFormState> {
  const t = getDictionary(await getLocale()).field;
  const parsed = storeVisitFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { errors: localizeVisitErrors(parsed.error.flatten().fieldErrors, t), message: t.fixErrors };
  }
  const visit = await db.storeVisit.create({ data: { ...parsed.data, status: "IN_PROGRESS" } });
  redirect(`/field/store-visits/${visit.id}`);
}

export async function updateStoreVisit(
  id: string,
  prevState: StoreVisitFormState,
  formData: FormData
): Promise<StoreVisitFormState> {
  const t = getDictionary(await getLocale()).field;
  const parsed = storeVisitFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { errors: localizeVisitErrors(parsed.error.flatten().fieldErrors, t), message: t.fixErrors };
  }
  await db.storeVisit.update({ where: { id }, data: parsed.data });
  redirect(`/field/store-visits/${id}`);
}

export async function deleteStoreVisit(id: string): Promise<void> {
  // Cascades to Product and StoreVisitPhoto at the DB level.
  await db.storeVisit.delete({ where: { id } });
  redirect("/field/store-visits");
}

export async function setStoreVisitStatus(id: string, status: StoreVisitStatus): Promise<void> {
  await db.storeVisit.update({ where: { id }, data: { status } });
  revalidatePath(`/field/store-visits/${id}`);
}

export type ItemFormState = {
  errors?: Partial<Record<string, string[]>>;
  message?: string;
};

function getPhotoFiles(formData: FormData): File[] {
  return formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
}

function localizeItemErrors(
  fieldErrors: Partial<Record<string, string[]>>,
  t: ReturnType<typeof getDictionary>["field"]
): Partial<Record<string, string[]>> {
  const localized: Partial<Record<string, string[]>> = {};
  for (const [field, messages] of Object.entries(fieldErrors)) {
    if (!messages || messages.length === 0) continue;
    if (messages.includes(UNSAFE_INPUT_MESSAGE)) {
      localized[field] = [t.unsafeContent];
      continue;
    }
    localized[field] = field === "productName" ? [t.products.nameRequired] : [t.addItem.negativeValue];
  }
  return localized;
}

export async function addStoreVisitItem(
  storeVisitId: string,
  prevState: ItemFormState,
  formData: FormData
): Promise<ItemFormState> {
  const t = getDictionary(await getLocale()).field;
  const parsed = productFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { errors: localizeItemErrors(parsed.error.flatten().fieldErrors, t), message: t.fixErrors };
  }
  const data = parsed.data;

  const item = await db.product.create({
    data: {
      storeVisitId,
      brandName: data.brandName,
      productName: data.productName,
      category: data.category,
      subcategory: data.subcategory,
      barcode: data.barcode,
      countryOfOrigin: data.countryOfOrigin,
      manufacturer: data.manufacturer,
      packageSize: data.packageSize,
      price: data.price,
      promotion: data.promotion,
      stockStatus: data.stockStatus,
      displayLocation: data.displayLocation,
      facingCount: data.facingCount,
      memo: data.memo,
    },
  });

  const files = getPhotoFiles(formData);
  if (files.length > 0) {
    const photoType = (formData.get("photoType") as string) || "PRODUCT";
    const uploaded = await Promise.all(files.map((f) => uploadFieldPhoto(f)));
    await db.storeVisitPhoto.createMany({
      data: uploaded.map((u) => ({
        storeVisitId,
        storeVisitItemId: item.id,
        photoType: photoType as StoreVisitPhotoType,
        fileUrl: u.url,
        fileName: u.fileName,
      })),
    });
  }

  redirect(`/field/store-visits/${storeVisitId}`);
}

export async function updateStoreVisitItem(
  storeVisitId: string,
  itemId: string,
  prevState: ItemFormState,
  formData: FormData
): Promise<ItemFormState> {
  const t = getDictionary(await getLocale()).field;
  const parsed = productFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { errors: localizeItemErrors(parsed.error.flatten().fieldErrors, t), message: t.fixErrors };
  }
  const data = parsed.data;

  // Ownership check -- this item must actually belong to the visit the URL says it does.
  const existing = await db.product.findUnique({ where: { id: itemId } });
  if (!existing || existing.storeVisitId !== storeVisitId) {
    return { message: t.fixErrors };
  }

  await db.product.update({
    where: { id: itemId },
    data: {
      brandName: data.brandName,
      productName: data.productName,
      category: data.category,
      subcategory: data.subcategory,
      barcode: data.barcode,
      countryOfOrigin: data.countryOfOrigin,
      manufacturer: data.manufacturer,
      packageSize: data.packageSize,
      price: data.price,
      promotion: data.promotion,
      stockStatus: data.stockStatus,
      displayLocation: data.displayLocation,
      facingCount: data.facingCount,
      memo: data.memo,
    },
  });

  const files = getPhotoFiles(formData);
  if (files.length > 0) {
    const photoType = (formData.get("photoType") as string) || "PRODUCT";
    const uploaded = await Promise.all(files.map((f) => uploadFieldPhoto(f)));
    await db.storeVisitPhoto.createMany({
      data: uploaded.map((u) => ({
        storeVisitId,
        storeVisitItemId: itemId,
        photoType: photoType as StoreVisitPhotoType,
        fileUrl: u.url,
        fileName: u.fileName,
      })),
    });
  }

  redirect(`/field/store-visits/${storeVisitId}/items/${itemId}`);
}

export async function deleteStoreVisitItem(storeVisitId: string, itemId: string): Promise<void> {
  const item = await db.product.findUnique({ where: { id: itemId } });
  if (!item || item.storeVisitId !== storeVisitId) return; // ownership check
  await db.product.delete({ where: { id: itemId } }); // cascades photos
  redirect(`/field/store-visits/${storeVisitId}`);
}

export async function uploadStoreVisitPhoto(storeVisitId: string, formData: FormData): Promise<{ error?: string }> {
  const files = getPhotoFiles(formData);
  if (files.length === 0) return { error: "no-file" };
  const photoType = (formData.get("photoType") as string) || "STORE";
  const captionRaw = formData.get("caption");
  const caption = typeof captionRaw === "string" && captionRaw.trim().length > 0 ? captionRaw.trim() : undefined;

  const uploaded = await Promise.all(files.map((f) => uploadFieldPhoto(f)));
  await db.storeVisitPhoto.createMany({
    data: uploaded.map((u) => ({
      storeVisitId,
      storeVisitItemId: null,
      photoType: photoType as StoreVisitPhotoType,
      fileUrl: u.url,
      fileName: u.fileName,
      caption,
    })),
  });
  revalidatePath(`/field/store-visits/${storeVisitId}`);
  return {};
}

export async function deleteStoreVisitPhoto(photoId: string, storeVisitId: string): Promise<void> {
  const photo = await db.storeVisitPhoto.findUnique({ where: { id: photoId } });
  if (!photo || photo.storeVisitId !== storeVisitId) return; // ownership check
  await deleteFieldPhoto(photo.fileUrl);
  await db.storeVisitPhoto.delete({ where: { id: photoId } });
  revalidatePath(`/field/store-visits/${storeVisitId}`);
}
