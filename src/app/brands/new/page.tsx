import { BrandForm } from "@/components/brand-form";
import { createBrand } from "@/app/brands/actions";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

export const dynamic = "force-dynamic";

export default async function NewBrandPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-6 py-10 sm:px-8 sm:py-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t.form.addTitle}</h1>
        <p className="text-sm text-muted-foreground">{t.form.addSubtitle}</p>
      </div>
      <BrandForm mode="create" locale={locale} action={createBrand} />
    </main>
  );
}
