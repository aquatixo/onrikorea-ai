import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { StoreVisitItemForm } from "@/components/field/store-visit-item-form";
import { updateStoreVisitItem } from "@/app/(dashboard)/field/store-visits/actions";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

export const dynamic = "force-dynamic";

export default async function EditStoreVisitItemPage(props: { params: Promise<{ id: string; itemId: string }> }) {
  const { id, itemId } = await props.params;
  const locale = await getLocale();
  const t = getDictionary(locale).field;

  const item = await db.storeVisitItem.findUnique({
    where: { id: itemId },
    include: { product: true },
  });

  // Ownership check -- this item must actually belong to the visit the URL says it does.
  if (!item || item.storeVisitId !== id) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl space-y-5 px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href={`/field/store-visits/${id}/items/${itemId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {t.itemDetail.back}
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">{t.addItem.editTitle}</h1>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <StoreVisitItemForm
          mode="update"
          item={item}
          locale={locale}
          action={updateStoreVisitItem.bind(null, id, itemId)}
        />
      </div>
    </main>
  );
}
