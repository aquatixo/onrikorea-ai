import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { Button } from "@/components/ui/button";
import { DeleteItemButton } from "@/components/field/delete-item-button";
import { PhotoLightbox } from "@/components/field/photo-lightbox";

export const dynamic = "force-dynamic";

function formatDate(d: Date, locale: string) {
  return d.toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default async function StoreVisitItemDetailPage(props: { params: Promise<{ id: string; itemId: string }> }) {
  const { id, itemId } = await props.params;
  const locale = await getLocale();
  const t = getDictionary(locale).field;

  const item = await db.storeVisitItem.findUnique({
    where: { id: itemId },
    include: {
      product: true,
      storeVisit: { include: { store: true } },
      photos: { orderBy: { createdAt: "asc" } },
    },
  });

  // Ownership check -- this item must actually belong to the visit the URL says it does.
  if (!item || item.storeVisitId !== id) notFound();

  const fields: { label: string; value: React.ReactNode }[] = [
    { label: t.itemDetail.storeLabel, value: item.storeVisit.store.name },
    { label: t.itemDetail.visitDateLabel, value: formatDate(item.storeVisit.visitDate, locale) },
    { label: t.itemDetail.priceLabel, value: item.price != null ? `₩${item.price.toLocaleString()}` : t.itemDetail.dash },
    { label: t.itemDetail.promotionLabel, value: item.promotion ?? t.itemDetail.dash },
    { label: t.itemDetail.stockLabel, value: item.stockStatus ?? t.itemDetail.dash },
    { label: t.itemDetail.displayLabel, value: item.displayLocation ?? t.itemDetail.dash },
    { label: t.itemDetail.facingLabel, value: item.facingCount ?? t.itemDetail.dash },
    { label: t.itemDetail.memoLabel, value: item.memo ?? t.itemDetail.dash },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl space-y-5 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex items-center justify-between">
        <Link
          href={`/field/store-visits/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> {t.itemDetail.back}
        </Link>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={
              <Link href={`/field/store-visits/${id}/items/${itemId}/edit`}>
                <Pencil className="size-4" /> {t.itemDetail.edit}
              </Link>
            }
          />
          <DeleteItemButton storeVisitId={id} itemId={itemId} locale={locale} size="sm" />
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{item.product.productName}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {t.itemDetail.brandLabel}: {item.product.brandName} · {t.itemDetail.categoryLabel}: {t.category[item.product.category]}
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {t.itemDetail.visitInfoHeading}
        </p>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.label} className="rounded-xl bg-muted/40 px-3.5 py-2.5">
              <dt className="text-xs font-medium text-muted-foreground">{f.label}</dt>
              <dd className="mt-0.5 text-sm break-words whitespace-pre-wrap">{f.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <h2 className="text-sm font-semibold">{t.itemDetail.photosHeading}</h2>
        <PhotoLightbox photos={item.photos} storeVisitId={id} locale={locale} />
      </section>
    </main>
  );
}
