import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { StoreVisitItemForm } from "@/components/field/store-visit-item-form";
import { createProduct } from "@/app/(dashboard)/field/products/actions";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const locale = await getLocale();
  const t = getDictionary(locale).field;
  const visits = await db.storeVisit.findMany({ include: { store: true }, orderBy: { visitDate: "desc" } });

  return (
    <main className="mx-auto w-full max-w-2xl space-y-5 px-4 py-8 sm:px-6 sm:py-10">
      <Link href="/field/products" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {t.back}
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">{t.products.addTitle}</h1>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <StoreVisitItemForm visits={visits} locale={locale} action={createProduct} />
      </div>
    </main>
  );
}
