import Link from "next/link";
import { ChevronsLeft, ChevronsRight, Plus } from "lucide-react";
import { WebsiteLink } from "@/components/website-link";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { BrandRow } from "@/components/brand-row";
import { BrandSearch } from "@/components/brand-search";
import { BrandExportMenu } from "@/components/brand-export-menu";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import type { Prisma } from "@prisma/client";

const PAGE_SIZE = 20;

function pageHref(page: number, q: string) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  if (q) params.set("q", q);
  return `/brands?${params.toString()}`;
}

function getPageWindow(currentPage: number, totalPages: number, maxLinks: number): number[] {
  let start = Math.max(1, currentPage - Math.floor(maxLinks / 2));
  const end = Math.min(totalPages, start + maxLinks - 1);
  start = Math.max(1, end - maxLinks + 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export default async function BrandsPage(props: PageProps<"/brands">) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const searchParams = await props.searchParams;

  const rawPage = Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page;
  const parsedPage = Number.parseInt(rawPage ?? "1", 10);
  const currentPage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const rawQ = Array.isArray(searchParams.q) ? searchParams.q[0] : searchParams.q;
  const q = (rawQ ?? "").trim();

  const where: Prisma.BrandWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { country: { contains: q, mode: "insensitive" } },
          { sku: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const [total, brands] = await Promise.all([
    db.brand.count({ where }),
    db.brand.findMany({
      where,
      orderBy: { sourceNo: "asc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasPrevious = currentPage > 1;
  const hasNext = currentPage < totalPages;
  const mobilePageWindow = getPageWindow(currentPage, totalPages, 3);
  const desktopPageWindow = getPageWindow(currentPage, totalPages, 10);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-6 py-10 sm:px-8 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.brands.title}</h1>
          <p className="text-sm text-muted-foreground">
            {q ? t.brands.countMatching(total) : t.brands.countTracked(total)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BrandSearch defaultValue={q} placeholder={t.brands.searchPlaceholder} />
          <Button
            nativeButton={false}
            render={
              <Link href="/brands/new">
                <Plus className="size-4" /> {t.brands.addBrand}
              </Link>
            }
          />
          <BrandExportMenu
            downloadAllLabel={t.brands.downloadAll}
            downloadPageLabel={t.brands.downloadPage}
            ariaLabel={t.brands.downloadAria}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t.brands.colNo}</TableHead>
                <TableHead>{t.brands.colMethodology}</TableHead>
                <TableHead>{t.brands.colName}</TableHead>
                <TableHead>{t.brands.colCountry}</TableHead>
                <TableHead>{t.brands.colSku}</TableHead>
                <TableHead>{t.brands.colYear}</TableHead>
                <TableHead>{t.brands.colWebsite}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {brands.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    {t.brands.noFound}
                  </TableCell>
                </TableRow>
              )}
              {brands.map((brand) => (
                <BrandRow key={brand.id} href={`/brands/${brand.id}`}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {brand.sourceNo ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {brand.methodology ?? "—"}
                  </TableCell>
                  <TableCell className="font-medium">{brand.name}</TableCell>
                  <TableCell className="text-muted-foreground">{brand.country ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{brand.sku ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {brand.foundedYear ?? "—"}
                  </TableCell>
                  <TableCell>
                    {brand.website ? (
                      <WebsiteLink website={brand.website} />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </BrandRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-center text-sm text-muted-foreground">
          {t.brands.pageOf(currentPage, totalPages)}
        </p>
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              {hasPrevious ? (
                <PaginationLink href={pageHref(1, q)} aria-label={t.brands.goFirst}>
                  <ChevronsLeft className="size-4" />
                </PaginationLink>
              ) : (
                <PaginationLink
                  href="#"
                  aria-disabled
                  aria-label={t.brands.goFirst}
                  className="pointer-events-none opacity-50"
                >
                  <ChevronsLeft className="size-4" />
                </PaginationLink>
              )}
            </PaginationItem>
            <PaginationItem>
              {hasPrevious ? (
                <PaginationPrevious
                  href={pageHref(currentPage - 1, q)}
                  text=""
                  aria-label={t.brands.goPrevious}
                />
              ) : (
                <PaginationPrevious
                  href="#"
                  aria-disabled
                  text=""
                  aria-label={t.brands.goPrevious}
                  className="pointer-events-none opacity-50"
                />
              )}
            </PaginationItem>
            {mobilePageWindow.map((page) => (
              <PaginationItem key={`m-${page}`} className="sm:hidden">
                <PaginationLink href={pageHref(page, q)} isActive={page === currentPage}>
                  {page}
                </PaginationLink>
              </PaginationItem>
            ))}
            {desktopPageWindow.map((page) => (
              <PaginationItem key={`d-${page}`} className="hidden sm:block">
                <PaginationLink href={pageHref(page, q)} isActive={page === currentPage}>
                  {page}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              {hasNext ? (
                <PaginationNext
                  href={pageHref(currentPage + 1, q)}
                  text=""
                  aria-label={t.brands.goNext}
                />
              ) : (
                <PaginationNext
                  href="#"
                  aria-disabled
                  text=""
                  aria-label={t.brands.goNext}
                  className="pointer-events-none opacity-50"
                />
              )}
            </PaginationItem>
            <PaginationItem>
              {hasNext ? (
                <PaginationLink href={pageHref(totalPages, q)} aria-label={t.brands.goLast}>
                  <ChevronsRight className="size-4" />
                </PaginationLink>
              ) : (
                <PaginationLink
                  href="#"
                  aria-disabled
                  aria-label={t.brands.goLast}
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
