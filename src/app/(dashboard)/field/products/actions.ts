"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { productFormSchema } from "@/lib/validation/field";
import { UNSAFE_INPUT_MESSAGE } from "@/lib/security/sanitize-input";
import { canModifyContent } from "@/lib/auth/ownership-server";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { requireSection, noAccessMessage } from "@/lib/auth/require-section";
import { attachItemPhotos } from "@/lib/store-visit/item-photos";
import { productListHref } from "@/lib/store-visit/product-list-href";

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
    if (field === "productName") localized[field] = [t.products.nameRequired];
  }
  return localized;
}

export async function createProduct(prevState: ProductFormState, formData: FormData): Promise<ProductFormState> {
  if (!(await requireSection("products"))) return { message: await noAccessMessage() };
  const t = getDictionary(await getLocale()).field;
  const storeVisitId = formData.get("storeVisitId");
  if (typeof storeVisitId !== "string" || !storeVisitId) {
    return { message: t.products.visitRequired };
  }

  const parsed = productFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { errors: localizeErrors(parsed.error.flatten().fieldErrors, t), message: t.fixErrors };
  }

  const session = await auth();
  const product = await db.product.create({ data: { storeVisitId, ...parsed.data, createdById: session?.user?.id } });
  await attachItemPhotos(formData, storeVisitId, product.id, session?.user?.id);
  redirect("/field/products");
}

export async function updateProduct(
  id: string,
  listHref: string,
  prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  if (!(await requireSection("products"))) return { message: await noAccessMessage() };
  const dict = getDictionary(await getLocale());
  const t = dict.field;

  const target = await db.product.findUnique({ where: { id }, select: { createdById: true, storeVisitId: true } });
  if (!target) return { message: t.fixErrors };
  if (!(await canModifyContent(target.createdById))) {
    return { message: dict.common.forbidden };
  }

  const parsed = productFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { errors: localizeErrors(parsed.error.flatten().fieldErrors, t), message: t.fixErrors };
  }

  await db.product.update({ where: { id }, data: parsed.data });
  const session = await auth();
  await attachItemPhotos(formData, target.storeVisitId, id, session?.user?.id);
  // listHref comes back from the client (bound action args aren't tamper-proof), so it's
  // rebuilt from its own query params -- the redirect can only ever land on the Products list.
  redirect(productListHref(Object.fromEntries(new URL(listHref, "http://x").searchParams)));
}

export async function deleteProduct(id: string): Promise<{ error?: string }> {
  if (!(await requireSection("products"))) return { error: await noAccessMessage() };
  const target = await db.product.findUnique({ where: { id }, select: { createdById: true } });
  if (!target) return {};
  if (!(await canModifyContent(target.createdById))) {
    return { error: getDictionary(await getLocale()).common.forbidden };
  }

  await db.product.delete({ where: { id } }); // cascades photos
  redirect("/field/products");
}
