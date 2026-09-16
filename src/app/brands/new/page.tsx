import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandForm } from "@/components/brand-form";
import { createBrand } from "@/app/brands/actions";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

export const dynamic = "force-dynamic";

export default async function NewBrandPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);

  return (
    <main className="mx-auto w-full max-w-2xl space-y-5 px-4 py-8 sm:px-6 sm:py-10">
      <Link href="/brands" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {t.form.back}
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t.form.addTitle}</h1>
        <p className="text-sm text-muted-foreground">{t.form.addSubtitle}</p>
      </div>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <BrandForm mode="create" locale={locale} action={createBrand} />
      </div>
    </main>
  );
}
