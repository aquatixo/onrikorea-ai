import { notFound } from "next/navigation";
import { BrandForm } from "@/components/brand-form";
import { updateBrand } from "@/app/brands/actions";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

export const dynamic = "force-dynamic";

export default async function EditBrandPage(props: PageProps<"/brands/[id]/edit">) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const { id } = await props.params;
  const brand = await db.brand.findUnique({ where: { id } });
  if (!brand) notFound();

  const updateBrandWithId = updateBrand.bind(null, id);

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-6 py-10 sm:px-8 sm:py-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t.form.editTitle}</h1>
        <p className="text-sm text-muted-foreground">{brand.name}</p>
      </div>
      <BrandForm mode="update" brand={brand} locale={locale} action={updateBrandWithId} />
    </main>
  );
}
