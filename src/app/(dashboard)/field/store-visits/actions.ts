"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { storeVisitFormSchema, productFormSchema } from "@/lib/validation/field";
import { UNSAFE_INPUT_MESSAGE } from "@/lib/security/sanitize-input";
import { uploadFieldPhoto, deleteFieldPhoto } from "@/lib/blob";
import { attachItemPhotos, getPhotoFiles } from "@/lib/store-visit/item-photos";
import { canModifyContent } from "@/lib/auth/ownership-server";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import type { StoreVisitPhotoType, StoreVisitStatus } from "@prisma/client";
import { requireSection, noAccessMessage } from "@/lib/auth/require-section";

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
    if (field === "visitors") localized[field] = [t.visits.visitorRequired];
  }
  return localized;
}

export async function createStoreVisit(
  prevState: StoreVisitFormState,
  formData: FormData
): Promise<StoreVisitFormState> {
  if (!(await requireSection("storeVisits"))) return { message: await noAccessMessage() };
  const t = getDictionary(await getLocale()).field;
  const parsed = storeVisitFormSchema.safeParse({
    ...Object.fromEntries(formData),
    visitors: formData.getAll("visitors"),
  });
  if (!parsed.success) {
    return { errors: localizeVisitErrors(parsed.error.flatten().fieldErrors, t), message: t.fixErrors };
  }
  const session = await auth();
  const visit = await db.storeVisit.create({
    data: { ...parsed.data, status: "IN_PROGRESS", createdById: session?.user?.id },
  });
  redirect(`/field/store-visits/${visit.id}`);
}

export async function updateStoreVisit(
  id: string,
  prevState: StoreVisitFormState,
  formData: FormData
): Promise<StoreVisitFormState> {
  if (!(await requireSection("storeVisits"))) return { message: await noAccessMessage() };
  const dict = getDictionary(await getLocale());
  const t = dict.field;

  const target = await db.storeVisit.findUnique({ where: { id }, select: { createdById: true } });
  if (!target) return { message: t.fixErrors };
  if (!(await canModifyContent(target.createdById))) {
    return { message: dict.common.forbidden };
  }

  const parsed = storeVisitFormSchema.safeParse({
    ...Object.fromEntries(formData),
    visitors: formData.getAll("visitors"),
  });
  if (!parsed.success) {
    return { errors: localizeVisitErrors(parsed.error.flatten().fieldErrors, t), message: t.fixErrors };
  }
  await db.storeVisit.update({ where: { id }, data: parsed.data });
  redirect(`/field/store-visits/${id}`);
}

export async function deleteStoreVisit(id: string): Promise<{ error?: string }> {
  if (!(await requireSection("storeVisits"))) return { error: await noAccessMessage() };
  const target = await db.storeVisit.findUnique({ where: { id }, select: { createdById: true } });
  if (!target) return {};
  if (!(await canModifyContent(target.createdById))) {
    return { error: getDictionary(await getLocale()).common.forbidden };
  }

  // Cascades to Product and StoreVisitPhoto at the DB level.
  await db.storeVisit.delete({ where: { id } });
  redirect("/field/store-visits");
}

export async function setStoreVisitStatus(id: string, status: StoreVisitStatus): Promise<{ error?: string }> {
  if (!(await requireSection("storeVisits"))) return { error: await noAccessMessage() };
  const target = await db.storeVisit.findUnique({ where: { id }, select: { createdById: true } });
  if (!target) return {};
  if (!(await canModifyContent(target.createdById))) {
    return { error: getDictionary(await getLocale()).common.forbidden };
  }

  await db.storeVisit.update({ where: { id }, data: { status } });
  revalidatePath(`/field/store-visits/${id}`);
  return {};
}

export type ItemFormState = {
  errors?: Partial<Record<string, string[]>>;
  message?: string;
};

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
  if (!(await requireSection("storeVisits"))) return { message: await noAccessMessage() };
  const t = getDictionary(await getLocale()).field;
  const parsed = productFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { errors: localizeItemErrors(parsed.error.flatten().fieldErrors, t), message: t.fixErrors };
  }
  const data = parsed.data;

  const session = await auth();
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
      createdById: session?.user?.id,
    },
  });

  await attachItemPhotos(formData, storeVisitId, item.id, session?.user?.id);

  redirect(`/field/store-visits/${storeVisitId}`);
}

export async function updateStoreVisitItem(
  storeVisitId: string,
  itemId: string,
  prevState: ItemFormState,
  formData: FormData
): Promise<ItemFormState> {
  if (!(await requireSection("storeVisits"))) return { message: await noAccessMessage() };
  const dict = getDictionary(await getLocale());
  const t = dict.field;

  // Referential check -- this item must actually belong to the visit the URL says it does.
  const existing = await db.product.findUnique({ where: { id: itemId } });
  if (!existing || existing.storeVisitId !== storeVisitId) {
    return { message: t.fixErrors };
  }
  if (!(await canModifyContent(existing.createdById))) {
    return { message: dict.common.forbidden };
  }

  const parsed = productFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { errors: localizeItemErrors(parsed.error.flatten().fieldErrors, t), message: t.fixErrors };
  }
  const data = parsed.data;

  const session = await auth();
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

  await attachItemPhotos(formData, storeVisitId, itemId, session?.user?.id);

  redirect(`/field/store-visits/${storeVisitId}/items/${itemId}`);
}

export async function deleteStoreVisitItem(storeVisitId: string, itemId: string): Promise<{ error?: string }> {
  if (!(await requireSection("storeVisits"))) return { error: await noAccessMessage() };
  const item = await db.product.findUnique({ where: { id: itemId } });
  if (!item || item.storeVisitId !== storeVisitId) return {}; // referential check
  if (!(await canModifyContent(item.createdById))) {
    return { error: getDictionary(await getLocale()).common.forbidden };
  }

  await db.product.delete({ where: { id: itemId } }); // cascades photos
  redirect(`/field/store-visits/${storeVisitId}`);
}

export async function uploadStoreVisitPhoto(storeVisitId: string, formData: FormData): Promise<{ error?: string }> {
  if (!(await requireSection("storeVisits"))) return { error: await noAccessMessage() };
  const files = await getPhotoFiles(formData);
  if (files.length === 0) return { error: "no-file" };
  const photoType = (formData.get("photoType") as string) || "STORE";
  const captionRaw = formData.get("caption");
  const caption = typeof captionRaw === "string" && captionRaw.trim().length > 0 ? captionRaw.trim() : undefined;

  const session = await auth();
  const uploaded = await Promise.all(files.map((f) => uploadFieldPhoto(f)));
  await db.storeVisitPhoto.createMany({
    data: uploaded.map((u) => ({
      storeVisitId,
      storeVisitItemId: null,
      photoType: photoType as StoreVisitPhotoType,
      fileUrl: u.url,
      fileName: u.fileName,
      caption,
      createdById: session?.user?.id,
    })),
  });
  revalidatePath(`/field/store-visits/${storeVisitId}`);
  return {};
}

export async function deleteStoreVisitPhoto(photoId: string, storeVisitId: string): Promise<{ error?: string }> {
  if (!(await requireSection("storeVisits"))) return { error: await noAccessMessage() };
  const photo = await db.storeVisitPhoto.findUnique({ where: { id: photoId } });
  if (!photo || photo.storeVisitId !== storeVisitId) return {}; // referential check
  if (!(await canModifyContent(photo.createdById))) {
    return { error: getDictionary(await getLocale()).common.forbidden };
  }

  await deleteFieldPhoto(photo.fileUrl);
  await db.storeVisitPhoto.delete({ where: { id: photoId } });
  revalidatePath(`/field/store-visits/${storeVisitId}`);
  return {};
}
