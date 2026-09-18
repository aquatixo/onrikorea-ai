"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { storeFormSchema } from "@/lib/validation/field";
import { UNSAFE_INPUT_MESSAGE } from "@/lib/security/sanitize-input";
import { uploadFieldPhoto, deleteFieldPhoto } from "@/lib/blob";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

function realImageFile(formData: FormData): File | null {
  const value = formData.get("image");
  return value instanceof File && value.size > 0 ? value : null;
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
  const t = getDictionary(await getLocale()).field;
  const parsed = storeFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { errors: localizeErrors(parsed.error.flatten().fieldErrors, t), message: t.fixErrors };
  }

  const image = realImageFile(formData);
  let imageUrl: string | undefined;
  let imageName: string | undefined;
  if (image) {
    const uploaded = await uploadFieldPhoto(image);
    imageUrl = uploaded.url;
    imageName = uploaded.fileName;
  }

  await db.store.create({ data: { ...parsed.data, imageUrl, imageName } });
  redirect("/field/stores");
}

export async function updateStore(id: string, prevState: StoreFormState, formData: FormData): Promise<StoreFormState> {
  const t = getDictionary(await getLocale()).field;
  const parsed = storeFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { errors: localizeErrors(parsed.error.flatten().fieldErrors, t), message: t.fixErrors };
  }

  const existing = await db.store.findUnique({ where: { id }, select: { imageUrl: true } });
  const image = realImageFile(formData);
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

export async function setStoreActive(id: string, isActive: boolean): Promise<void> {
  await db.store.update({ where: { id }, data: { isActive } });
  revalidatePath("/field/stores");
}
