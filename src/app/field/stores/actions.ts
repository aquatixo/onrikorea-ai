"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { storeFormSchema } from "@/lib/validation/field";
import { UNSAFE_INPUT_MESSAGE } from "@/lib/security/sanitize-input";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

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
  await db.store.create({ data: parsed.data });
  redirect("/field/stores");
}

export async function updateStore(id: string, prevState: StoreFormState, formData: FormData): Promise<StoreFormState> {
  const t = getDictionary(await getLocale()).field;
  const parsed = storeFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { errors: localizeErrors(parsed.error.flatten().fieldErrors, t), message: t.fixErrors };
  }
  await db.store.update({ where: { id }, data: parsed.data });
  redirect("/field/stores");
}

export async function setStoreActive(id: string, isActive: boolean): Promise<void> {
  await db.store.update({ where: { id }, data: { isActive } });
  revalidatePath("/field/stores");
}
