"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { extractDomain } from "@/lib/extract-domain";
import { brandFormSchema } from "@/lib/validation/brand";
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
  if (fieldErrors.name) localized.name = [t.nameRequired];
  if (fieldErrors.foundedYear) localized.foundedYear = [t.yearInvalid];
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

  const brand = await db.brand.create({
    data: { ...data, websiteDomain: extractDomain(data.website) },
  });

  redirect(`/brands/${brand.id}`);
}

export async function updateBrand(
  id: string,
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

  redirect(`/brands/${id}`);
}

export async function deleteBrand(id: string) {
  await db.brand.delete({ where: { id } });
  redirect("/brands");
}
