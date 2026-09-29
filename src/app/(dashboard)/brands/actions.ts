"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { extractDomain } from "@/lib/extract-domain";
import { brandFormSchema, brandLogSchema } from "@/lib/validation/brand";
import { UNSAFE_INPUT_MESSAGE } from "@/lib/security/sanitize-input";
import { canModifyContent } from "@/lib/auth/ownership-server";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

export type BrandFormState = {
  errors?: Partial<Record<string, string[]>>;
  message?: string;
};

function localizeValidationErrors(
  fieldErrors: Partial<Record<string, string[]>>,
  t: ReturnType<typeof getDictionary>["form"]
): Partial<Record<string, string[]>> {
  const localized: Partial<Record<string, string[]>> = {};
  for (const [field, messages] of Object.entries(fieldErrors)) {
    if (!messages || messages.length === 0) continue;
    if (messages.includes(UNSAFE_INPUT_MESSAGE)) {
      localized[field] = [t.unsafeContent];
      continue;
    }
    if (field === "name") localized[field] = [t.nameRequired];
    if (field === "foundedYear") localized[field] = [t.yearInvalid];
    if (field === "status") localized[field] = [t.statusRequired];
  }
  return localized;
}

export async function createBrand(
  prevState: BrandFormState,
  formData: FormData
): Promise<BrandFormState> {
  const t = getDictionary(await getLocale()).form;

  const parsed = brandFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      errors: localizeValidationErrors(parsed.error.flatten().fieldErrors, t),
      message: t.fixErrors,
    };
  }
  const data = parsed.data;

  const existing = await db.brand.findFirst({
    where: { name: { equals: data.name, mode: "insensitive" } },
  });
  if (existing) {
    return {
      errors: { name: [t.duplicateName] },
      message: t.duplicateMessage,
    };
  }

  const session = await auth();
  const brand = await db.brand.create({
    data: { ...data, websiteDomain: extractDomain(data.website), createdById: session?.user?.id },
  });

  redirect(`/brands/${brand.id}`);
}

export async function updateBrand(
  id: string,
  returnTo: string | undefined,
  prevState: BrandFormState,
  formData: FormData
): Promise<BrandFormState> {
  const dict = getDictionary(await getLocale());
  const t = dict.form;

  const target = await db.brand.findUnique({ where: { id }, select: { createdById: true } });
  if (!target) return { message: t.fixErrors };
  if (!(await canModifyContent(target.createdById))) {
    return { message: dict.common.forbidden };
  }

  const parsed = brandFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      errors: localizeValidationErrors(parsed.error.flatten().fieldErrors, t),
      message: t.fixErrors,
    };
  }
  const data = parsed.data;

  const existing = await db.brand.findFirst({
    where: { name: { equals: data.name, mode: "insensitive" }, id: { not: id } },
  });
  if (existing) {
    return {
      errors: { name: [t.duplicateName] },
      message: t.duplicateMessage,
    };
  }

  await db.brand.update({
    where: { id },
    data: { ...data, websiteDomain: extractDomain(data.website) },
  });

  // Carry the list page/search/pageSize the user came from through to the detail page,
  // so its own "back" link (and a subsequent delete) still lands back where they were,
  // not on a reset page 1.
  redirect(returnTo ? `/brands/${id}?returnTo=${encodeURIComponent(returnTo)}` : `/brands/${id}`);
}

export async function deleteBrand(id: string, returnTo: string | undefined): Promise<{ error?: string }> {
  const target = await db.brand.findUnique({ where: { id }, select: { createdById: true } });
  if (!target) return {};
  if (!(await canModifyContent(target.createdById))) {
    return { error: getDictionary(await getLocale()).common.forbidden };
  }

  await db.brand.delete({ where: { id } });
  redirect(returnTo && returnTo.startsWith("/brands") ? returnTo : "/brands");
}

export async function createBrandLog(brandId: string, body: string): Promise<{ success: true } | { error: string }> {
  const dict = getDictionary(await getLocale());
  const t = dict.detail;

  const parsed = brandLogSchema.shape.body.safeParse(body);
  if (!parsed.success) return { error: t.logBodyRequired };

  const session = await auth();
  await db.brandLog.create({
    data: { brandId, body: parsed.data, createdById: session?.user?.id },
  });

  revalidatePath(`/brands/${brandId}`);
  return { success: true };
}

export async function updateBrandLog(logId: string, brandId: string, body: string): Promise<{ success: true } | { error: string }> {
  const dict = getDictionary(await getLocale());
  const t = dict.detail;

  // Referential check -- this entry must actually belong to the brand the URL says it does.
  const existing = await db.brandLog.findUnique({ where: { id: logId }, select: { createdById: true, brandId: true } });
  if (!existing || existing.brandId !== brandId) return { error: t.logBodyRequired };
  if (!(await canModifyContent(existing.createdById))) {
    return { error: dict.common.forbidden };
  }

  const parsed = brandLogSchema.shape.body.safeParse(body);
  if (!parsed.success) return { error: t.logBodyRequired };

  await db.brandLog.update({ where: { id: logId }, data: { body: parsed.data } });
  revalidatePath(`/brands/${brandId}`);
  return { success: true };
}

export async function deleteBrandLog(logId: string, brandId: string): Promise<{ error?: string }> {
  const existing = await db.brandLog.findUnique({ where: { id: logId }, select: { createdById: true, brandId: true } });
  if (!existing || existing.brandId !== brandId) return {};
  if (!(await canModifyContent(existing.createdById))) {
    return { error: getDictionary(await getLocale()).common.forbidden };
  }

  await db.brandLog.delete({ where: { id: logId } });
  revalidatePath(`/brands/${brandId}`);
  return {};
}
