"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { productFormSchema } from "@/lib/validation/field";
import { UNSAFE_INPUT_MESSAGE } from "@/lib/security/sanitize-input";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

export type ProductFormState = {
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
    if (field === "brandName" || field === "productName") localized[field] = [t.products.nameRequired];
  }
  return localized;
}

export async function createProduct(prevState: ProductFormState, formData: FormData): Promise<ProductFormState> {
  const t = getDictionary(await getLocale()).field;
  const parsed = productFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { errors: localizeErrors(parsed.error.flatten().fieldErrors, t), message: t.fixErrors };
  }
  await db.product.create({ data: parsed.data });
  redirect("/field/products");
}

export async function updateProduct(
  id: string,
  prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const t = getDictionary(await getLocale()).field;
  const parsed = productFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { errors: localizeErrors(parsed.error.flatten().fieldErrors, t), message: t.fixErrors };
  }
  await db.product.update({ where: { id }, data: parsed.data });
  redirect("/field/products");
}

export async function deleteProduct(id: string): Promise<{ error?: string }> {
  const t = getDictionary(await getLocale()).field;
  const inUse = await db.storeVisitItem.findFirst({ where: { productId: id } });
  if (inUse) return { error: t.products.deleteBlocked };
  await db.product.delete({ where: { id } });
  redirect("/field/products");
}
