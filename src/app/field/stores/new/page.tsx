import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { StoreForm } from "@/components/field/store-form";
import { createStore } from "@/app/field/stores/actions";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

export default async function NewStorePage() {
  const locale = await getLocale();
  const t = getDictionary(locale).field;

  return (
    <main className="mx-auto w-full max-w-2xl space-y-5 px-4 py-8 sm:px-6 sm:py-10">
      <Link href="/field/stores" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {t.back}
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">{t.stores.addTitle}</h1>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <StoreForm mode="create" locale={locale} action={createStore} />
      </div>
    </main>
  );
}
