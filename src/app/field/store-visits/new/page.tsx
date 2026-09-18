import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { StoreVisitForm } from "@/components/field/store-visit-form";
import { createStoreVisit } from "@/app/field/store-visits/actions";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

export const dynamic = "force-dynamic";

export default async function NewStoreVisitPage() {
  const locale = await getLocale();
  const t = getDictionary(locale).field;
  const stores = await db.store.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });

  return (
    <main className="mx-auto w-full max-w-xl space-y-5 px-4 py-8 sm:px-6 sm:py-10">
      <Link href="/field/store-visits" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {t.back}
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">{t.visits.newTitle}</h1>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <StoreVisitForm mode="create" stores={stores} locale={locale} action={createStoreVisit} />
      </div>
    </main>
  );
}
