import Link from "next/link";
import { ChevronsLeft, ChevronsRight, Package, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { PageSizeControl } from "@/components/page-size-control";
import { BrandSearch } from "@/components/brand-search";
import { ClickableRow } from "@/components/field/clickable-row";
import { StopPropagation } from "@/components/field/stop-propagation";
import { DeleteProductButton } from "@/components/field/delete-product-button";
import { getPageWindow, parsePageSize } from "@/lib/pagination";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

function formatDate(d: Date, locale: string) {
  return d.toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", { year: "numeric", month: "short", day: "numeric" });
}

function pageHref(page: number, q: string, pageSize: number) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  if (q) params.set("q", q);
  params.set("pageSize", String(pageSize));
  return `/field/products?${params.toString()}`;
}

export default async function FieldProductsPage(props: {
  searchParams: Promise<{ q?: string; page?: string; pageSize?: string }>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale).field;
  const { q: rawQ, page: rawPage, pageSize: rawPageSize } = await props.searchParams;
  const q = (rawQ ?? "").trim();

  const parsedPage = Number.parseInt(rawPage ?? "1", 10);
  const currentPage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const pageSize = parsePageSize(rawPageSize);

  const where: Prisma.ProductWhereInput = q
    ? {
        OR: [
          { productName: { contains: q, mode: "insensitive" } },
          { brandName: { contains: q, mode: "insensitive" } },
          { barcode: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const [total, products] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      include: { storeVisit: { include: { store: true } } },
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasPrevious = currentPage > 1;
  const hasNext = currentPage < totalPages;
  const mobilePageWindow = getPageWindow(currentPage, totalPages, 3);
  const desktopPageWindow = getPageWindow(currentPage, totalPages, 10);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-6 py-10 sm:px-8 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
            <Package className="size-5 text-primary" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t.products.title}</h1>
            <p className="text-sm text-muted-foreground">{t.products.subtitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PageSizeControl value={pageSize} label={t.products.rowsPerPage} />
          <BrandSearch defaultValue={q} placeholder={t.products.searchPlaceholder} />
          <Button
            nativeButton={false}
            render={
              <Link href="/field/products/new">
                <Package className="size-4" /> {t.products.addProduct}
              </Link>
            }
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-foreground/10">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t.products.colName}</TableHead>
                <TableHead>{t.products.colBrand}</TableHead>
                <TableHead>{t.products.colStore}</TableHead>
                <TableHead>{t.products.colVisitDate}</TableHead>
                <TableHead>{t.products.colCategory}</TableHead>
                <TableHead>{t.products.colBarcode}</TableHead>
                <TableHead>{t.products.colAction}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    {t.products.noFound}
                  </TableCell>
                </TableRow>
              )}
              {products.map((p) => (
                <ClickableRow
                  key={p.id}
                  href={`/field/store-visits/${p.storeVisitId}/items/${p.id}`}
                >
                  <TableCell className="font-medium">{p.productName}</TableCell>
                  <TableCell className="text-muted-foreground">{p.brandName ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{p.storeVisit.store.name}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(p.storeVisit.visitDate, locale)}</TableCell>
                  <TableCell className="text-muted-foreground">{t.category[p.category]}</TableCell>
                  <TableCell className="text-muted-foreground">{p.barcode ?? "—"}</TableCell>
                  <TableCell>
                    <StopPropagation>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          nativeButton={false}
                          render={<Link href={`/field/products/${p.id}/edit`}><Pencil className="size-4" /></Link>}
                        />
                        <DeleteProductButton productId={p.id} locale={locale} />
                      </div>
                    </StopPropagation>
                  </TableCell>
                </ClickableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-center text-sm text-muted-foreground">{t.products.pageOf(currentPage, totalPages)}</p>
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              {hasPrevious ? (
                <PaginationLink href={pageHref(1, q, pageSize)} aria-label={t.products.goFirst}>
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
                  href={pageHref(currentPage - 1, q, pageSize)}
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
                <PaginationLink href={pageHref(page, q, pageSize)} isActive={page === currentPage}>
                  {page}
                </PaginationLink>
              </PaginationItem>
            ))}
            {desktopPageWindow.map((page) => (
              <PaginationItem key={`d-${page}`} className="hidden sm:block">
                <PaginationLink href={pageHref(page, q, pageSize)} isActive={page === currentPage}>
                  {page}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              {hasNext ? (
                <PaginationNext
                  href={pageHref(currentPage + 1, q, pageSize)}
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
                <PaginationLink href={pageHref(totalPages, q, pageSize)} aria-label={t.products.goLast}>
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
    </main>
  );
}
