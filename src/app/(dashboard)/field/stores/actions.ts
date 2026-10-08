"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { storeFormSchema } from "@/lib/validation/field";
import { UNSAFE_INPUT_MESSAGE } from "@/lib/security/sanitize-input";
import { uploadFieldPhoto, deleteFieldPhoto, isAllowedImageType } from "@/lib/blob";
import { canModifyContent } from "@/lib/auth/ownership-server";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { requireSection, noAccessMessage } from "@/lib/auth/require-section";
import { MAX_UPLOAD_BYTES } from "@/lib/upload-limits";

async function realImageFile(formData: FormData): Promise<File | null> {
  const value = formData.get("image");
  return value instanceof File && value.size > 0 && value.size <= MAX_UPLOAD_BYTES && (await isAllowedImageType(value))
    ? value
    : null;
}

export type StoreFormState = {
  errors?: Partial<Record<string, string[]>>;
  message?: string;
};

function localizeErrors(
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
    if (field === "name") localized[field] = [t.stores.nameRequired];
  }
  return localized;
}

export async function createStore(prevState: StoreFormState, formData: FormData): Promise<StoreFormState> {
  if (!(await requireSection("stores"))) return { message: await noAccessMessage() };
  const t = getDictionary(await getLocale()).field;
  const parsed = storeFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { errors: localizeErrors(parsed.error.flatten().fieldErrors, t), message: t.fixErrors };
  }

  const image = await realImageFile(formData);
  let imageUrl: string | undefined;
  let imageName: string | undefined;
  if (image) {
    const uploaded = await uploadFieldPhoto(image);
    imageUrl = uploaded.url;
    imageName = uploaded.fileName;
  }

  const session = await auth();
  await db.store.create({ data: { ...parsed.data, imageUrl, imageName, createdById: session?.user?.id } });
  redirect("/field/stores");
}

export async function updateStore(id: string, prevState: StoreFormState, formData: FormData): Promise<StoreFormState> {
  if (!(await requireSection("stores"))) return { message: await noAccessMessage() };
  const dict = getDictionary(await getLocale());
  const t = dict.field;

  const existing = await db.store.findUnique({ where: { id }, select: { imageUrl: true, createdById: true } });
  if (!existing) return { message: t.fixErrors };
  if (!(await canModifyContent(existing.createdById))) {
    return { message: dict.common.forbidden };
  }

  const parsed = storeFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { errors: localizeErrors(parsed.error.flatten().fieldErrors, t), message: t.fixErrors };
  }

  const image = await realImageFile(formData);
  const removeImage = formData.get("removeImage") === "true";

  let imageUrl: string | null | undefined;
  let imageName: string | null | undefined;
  if (image) {
    const uploaded = await uploadFieldPhoto(image);
    if (existing?.imageUrl) await deleteFieldPhoto(existing.imageUrl);
    imageUrl = uploaded.url;
    imageName = uploaded.fileName;
  } else if (removeImage && existing?.imageUrl) {
    await deleteFieldPhoto(existing.imageUrl);
    imageUrl = null;
    imageName = null;
  }

  await db.store.update({
    where: { id },
    data: { ...parsed.data, ...(imageUrl !== undefined ? { imageUrl, imageName } : {}) },
  });
  redirect("/field/stores");
}

export async function setStoreActive(id: string, isActive: boolean): Promise<{ error?: string }> {
  if (!(await requireSection("stores"))) return { error: await noAccessMessage() };
  const existing = await db.store.findUnique({ where: { id }, select: { createdById: true } });
  if (!existing) return {};
  if (!(await canModifyContent(existing.createdById))) {
    return { error: getDictionary(await getLocale()).common.forbidden };
  }

  await db.store.update({ where: { id }, data: { isActive } });
  revalidatePath("/field/stores");
  return {};
}

export async function deleteStore(id: string): Promise<{ error?: string }> {
  if (!(await requireSection("stores"))) return { error: await noAccessMessage() };
  const dict = getDictionary(await getLocale());
  const t = dict.field;

  const existing = await db.store.findUnique({ where: { id }, select: { imageUrl: true, createdById: true } });
  if (!existing) return {};
  if (!(await canModifyContent(existing.createdById))) {
    return { error: dict.common.forbidden };
  }

  const inUse = await db.storeVisit.findFirst({ where: { storeId: id } });
  if (inUse) return { error: t.stores.deleteBlocked };

  if (existing.imageUrl) await deleteFieldPhoto(existing.imageUrl);

  await db.store.delete({ where: { id } });
  redirect("/field/stores");
}
