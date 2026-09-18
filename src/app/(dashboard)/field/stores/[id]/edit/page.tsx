import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { StoreForm } from "@/components/field/store-form";
import { updateStore } from "@/app/(dashboard)/field/stores/actions";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

export const dynamic = "force-dynamic";

export default async function EditStorePage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const locale = await getLocale();
  const t = getDictionary(locale).field;
  const store = await db.store.findUnique({ where: { id } });
  if (!store) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl space-y-5 px-4 py-8 sm:px-6 sm:py-10">
      <Link href="/field/stores" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {t.back}
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">{t.stores.editTitle}</h1>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <StoreForm mode="update" store={store} locale={locale} action={updateStore.bind(null, id)} />
      </div>
    </main>
  );
}
