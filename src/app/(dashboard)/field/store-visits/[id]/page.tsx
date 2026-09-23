import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronsLeft, ChevronsRight, Pencil, Plus, Camera } from "lucide-react";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { PageSizeControl } from "@/components/page-size-control";
import { STORE_VISIT_STATUS_STYLE } from "@/lib/field-status";
import { getPageWindow, parsePageSize } from "@/lib/pagination";
import { VisitStatusControl } from "@/components/field/visit-status-control";
import { DeleteVisitButton } from "@/components/field/delete-visit-button";
import { DeleteItemButton } from "@/components/field/delete-item-button";
import { ClickableTr } from "@/components/field/clickable-tr";
import { StopPropagation } from "@/components/field/stop-propagation";
import { UploadStorePhotoForm } from "@/components/field/upload-store-photo-form";
import { PhotoLightbox } from "@/components/field/photo-lightbox";

export const dynamic = "force-dynamic";

function formatDate(d: Date, locale: string) {
  return d.toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", { year: "numeric", month: "short", day: "numeric" });
}

function pageHref(id: string, page: number, pageSize: number) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  return `/field/store-visits/${id}?${params.toString()}`;
}

export default async function StoreVisitDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const { id } = await props.params;
  const { page: rawPage, pageSize: rawPageSize } = await props.searchParams;
  const locale = await getLocale();
  const t = getDictionary(locale).field;

  const parsedPage = Number.parseInt(rawPage ?? "1", 10);
  const currentPage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const pageSize = parsePageSize(rawPageSize);

  const visit = await db.storeVisit.findUnique({
    where: { id },
    include: {
      store: true,
      photos: { where: { storeVisitItemId: null }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!visit) notFound();

  const [itemCount, items] = await Promise.all([
    db.product.count({ where: { storeVisitId: id } }),
    db.product.findMany({
      where: { storeVisitId: id },
      include: { photos: true },
      orderBy: { createdAt: "asc" },
      skip: (currentPage - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(itemCount / pageSize));
  const hasPrevious = currentPage > 1;
  const hasNext = currentPage < totalPages;
  const mobilePageWindow = getPageWindow(currentPage, totalPages, 3);
  const desktopPageWindow = getPageWindow(currentPage, totalPages, 10);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex items-center justify-between">
        <Link href="/field/store-visits" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> {t.visits.back}
        </Link>
        <div className="flex items-center gap-2">
          <VisitStatusControl visitId={visit.id} status={visit.status} locale={locale} />
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={
              <Link href={`/field/store-visits/${visit.id}/edit`}>
                <Pencil className="size-4" /> {t.visits.edit}
              </Link>
            }
          />
          <DeleteVisitButton visitId={visit.id} locale={locale} />
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{visit.store.name}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {visit.store.chain ?? "—"} · {formatDate(visit.visitDate, locale)} · {visit.visitor}
            </p>
          </div>
          <Badge className={STORE_VISIT_STATUS_STYLE[visit.status]}>{t.visitStatus[visit.status]}</Badge>
        </div>
        {visit.memo && (
          <div className="mt-4 rounded-xl bg-muted/40 p-3.5">
            <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t.visits.memoLabel}
            </p>
            <p className="text-sm whitespace-pre-wrap">{visit.memo}</p>
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">
            {t.visits.itemsHeading} ({itemCount})
          </h2>
          <div className="flex items-center gap-2">
            <PageSizeControl value={pageSize} label={t.products.rowsPerPage} />
            <Button
              size="sm"
              nativeButton={false}
              render={
                <Link href={`/field/store-visits/${visit.id}/add-item`}>
                  <Plus className="size-4" /> {t.visits.addProduct}
                </Link>
              }
            />
          </div>
        </div>

        {itemCount === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">{t.visits.noItemsYet}</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t.visits.colItemProduct}</th>
                    <th className="px-3 py-2 font-medium">{t.visits.colItemBrand}</th>
                    <th className="px-3 py-2 font-medium">{t.visits.colItemPrice}</th>
                    <th className="px-3 py-2 font-medium">{t.visits.colItemPromotion}</th>
                    <th className="px-3 py-2 font-medium">{t.visits.colItemStock}</th>
                    <th className="px-3 py-2 font-medium">{t.visits.colItemDisplay}</th>
                    <th className="px-3 py-2 font-medium">{t.visits.colItemFacing}</th>
                    <th className="px-3 py-2 font-medium">{t.visits.colItemPhotos}</th>
                    <th className="px-3 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((item) => (
                    <ClickableTr key={item.id} href={`/field/store-visits/${visit.id}/items/${item.id}`}>
                      <td className="px-3 py-2 font-medium">{item.productName}</td>
                      <td className="px-3 py-2 text-muted-foreground">{item.brandName ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {item.price != null ? `₩${item.price.toLocaleString()}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{item.promotion ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{item.stockStatus ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{item.displayLocation ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{item.facingCount ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {item.photos.length > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Camera className="size-3.5" /> {item.photos.length}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <StopPropagation>
                          <DeleteItemButton storeVisitId={visit.id} itemId={item.id} locale={locale} />
                        </StopPropagation>
                      </td>
                    </ClickableTr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-2">
              <p className="text-center text-sm text-muted-foreground">{t.products.pageOf(currentPage, totalPages)}</p>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    {hasPrevious ? (
                      <PaginationLink href={pageHref(visit.id, 1, pageSize)} aria-label={t.products.goFirst}>
                        <ChevronsLeft className="size-4" />
                      </PaginationLink>
                    ) : (
                      <PaginationLink
                        href="#"
                        aria-disabled
                        aria-label={t.products.goFirst}
                        className="pointer-events-none opacity-50"
                      >
                        <ChevronsLeft className="size-4" />
                      </PaginationLink>
                    )}
                  </PaginationItem>
                  <PaginationItem>
                    {hasPrevious ? (
                      <PaginationPrevious
                        href={pageHref(visit.id, currentPage - 1, pageSize)}
                        text=""
                        aria-label={t.products.goPrevious}
                      />
                    ) : (
                      <PaginationPrevious
                        href="#"
                        aria-disabled
                        text=""
                        aria-label={t.products.goPrevious}
                        className="pointer-events-none opacity-50"
                      />
                    )}
                  </PaginationItem>
                  {mobilePageWindow.map((page) => (
                    <PaginationItem key={`m-${page}`} className="sm:hidden">
                      <PaginationLink href={pageHref(visit.id, page, pageSize)} isActive={page === currentPage}>
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  {desktopPageWindow.map((page) => (
                    <PaginationItem key={`d-${page}`} className="hidden sm:block">
                      <PaginationLink href={pageHref(visit.id, page, pageSize)} isActive={page === currentPage}>
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    {hasNext ? (
                      <PaginationNext
                        href={pageHref(visit.id, currentPage + 1, pageSize)}
                        text=""
                        aria-label={t.products.goNext}
                      />
                    ) : (
                      <PaginationNext
                        href="#"
                        aria-disabled
                        text=""
                        aria-label={t.products.goNext}
                        className="pointer-events-none opacity-50"
                      />
                    )}
                  </PaginationItem>
                  <PaginationItem>
                    {hasNext ? (
                      <PaginationLink href={pageHref(visit.id, totalPages, pageSize)} aria-label={t.products.goLast}>
                        <ChevronsRight className="size-4" />
                      </PaginationLink>
                    ) : (
                      <PaginationLink
                        href="#"
                        aria-disabled
                        aria-label={t.products.goLast}
                        className="pointer-events-none opacity-50"
                      >
                        <ChevronsRight className="size-4" />
                      </PaginationLink>
                    )}
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </>
        )}
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <h2 className="text-sm font-semibold">{t.visits.storePhotosHeading}</h2>
        <UploadStorePhotoForm storeVisitId={visit.id} locale={locale} />
        {visit.photos.length > 0 ? (
          <PhotoLightbox photos={visit.photos} storeVisitId={visit.id} locale={locale} />
        ) : (
          <p className="text-sm text-muted-foreground">{t.visits.noStorePhotosYet}</p>
        )}
      </section>
    </main>
  );
}
