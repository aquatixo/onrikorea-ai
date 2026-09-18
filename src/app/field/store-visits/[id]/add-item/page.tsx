import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { StoreVisitItemForm } from "@/components/field/store-visit-item-form";
import { addStoreVisitItem } from "@/app/field/store-visits/actions";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

export const dynamic = "force-dynamic";

export default async function AddStoreVisitItemPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const locale = await getLocale();
  const t = getDictionary(locale).field;

  const [visit, products] = await Promise.all([
    db.storeVisit.findUnique({ where: { id } }),
    db.product.findMany({ orderBy: { productName: "asc" } }),
  ]);
  if (!visit) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl space-y-5 px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href={`/field/store-visits/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {t.itemDetail.back}
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">{t.addItem.title}</h1>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <StoreVisitItemForm mode="create" products={products} locale={locale} action={addStoreVisitItem.bind(null, id)} />
      </div>
    </main>
  );
}
