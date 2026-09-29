import { ChevronsLeft, ChevronsRight, MessagesSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { WebsiteLink } from "@/components/website-link";
import { CommunicationStatusFilter } from "@/components/communication-status-filter";
import { PageSizeControl } from "@/components/page-size-control";
import { db } from "@/lib/db";
import { STATUS_STYLE } from "@/lib/brand-status";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { getPageWindow, parsePageSize } from "@/lib/pagination";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

function pageHref(page: number, q: string, status: string, pageSize: number) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  if (q) params.set("q", q);
  if (status !== "ALL") params.set("status", status);
  params.set("pageSize", String(pageSize));
  return `/brands/communications?${params.toString()}`;
}

export default async function BrandCommunicationsPage(props: {
  searchParams: Promise<{ status?: string; q?: string; page?: string; pageSize?: string }>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const { status: rawStatus, q: rawQ, page: rawPage, pageSize: rawPageSize } = await props.searchParams;
  const statusFilter = rawStatus === "REPLIED" || rawStatus === "CONTACTED" ? rawStatus : "ALL";
  const q = (rawQ ?? "").trim();

  const parsedPage = Number.parseInt(rawPage ?? "1", 10);
  const currentPage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const pageSize = parsePageSize(rawPageSize);

  // "Actively tracked" is defined by having a progress log, not by status -- status
  // alone would also match brands from months-old outreach that are no longer being
  // worked, since it's never reset once set (see BrandLog's schema comment).
  const where: Prisma.BrandWhereInput = {
    logs: { some: {} },
    ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { country: { contains: q, mode: "insensitive" } },
            { sku: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  // Sorted by most-recently-active first, which Prisma can't express as an orderBy on a
  // relation aggregate -- the matching set is small (brands actively worked, not the
  // full 1000+ list), so fetching it whole and sorting/paginating in JS is simpler and
  // cheap at this scale.
  const matched = await db.brand.findMany({
    where,
    include: { logs: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  matched.sort((a, b) => (b.logs[0]?.createdAt.getTime() ?? 0) - (a.logs[0]?.createdAt.getTime() ?? 0));

  const total = matched.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const brands = matched.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const hasPrevious = currentPage > 1;
  const hasNext = currentPage < totalPages;
  const mobilePageWindow = getPageWindow(currentPage, totalPages, 3);
  const desktopPageWindow = getPageWindow(currentPage, totalPages, 10);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-6 py-10 sm:px-8 sm:py-12">
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
          <MessagesSquare className="size-5 text-primary" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.communications.title}</h1>
          <p className="text-sm text-muted-foreground">{t.communications.subtitle}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <BrandSearch defaultValue={q} placeholder={t.brands.searchPlaceholder} />
        <CommunicationStatusFilter value={statusFilter} locale={locale} />
        <PageSizeControl value={pageSize} label={t.brands.rowsPerPage} />
      </div>

      <p className="text-sm text-muted-foreground">{t.communications.countTracked(total)}</p>

      <div className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-foreground/10">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t.communications.colName}</TableHead>
                <TableHead>{t.communications.colCountry}</TableHead>
                <TableHead>{t.communications.colSku}</TableHead>
                <TableHead>{t.communications.colWebsite}</TableHead>
                <TableHead>{t.communications.colStatus}</TableHead>
                <TableHead>{t.communications.colLatest}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {brands.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    {t.communications.noFound}
                  </TableCell>
                </TableRow>
              )}
              {brands.map((brand) => (
                <BrandRow
                  key={brand.id}
                  href={`/brands/${brand.id}?returnTo=${encodeURIComponent(pageHref(currentPage, q, statusFilter, pageSize))}`}
                >
                  <TableCell className="font-medium">{brand.name}</TableCell>
                  <TableCell className="text-muted-foreground">{brand.country ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{brand.sku ?? "—"}</TableCell>
                  <TableCell>
                    {brand.website ? (
                      <WebsiteLink website={brand.website} />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_STYLE[brand.status]}>{t.status[brand.status]}</Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">
                    {brand.logs[0]?.body ?? "—"}
                  </TableCell>
                </BrandRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-center text-sm text-muted-foreground">{t.brands.pageOf(currentPage, totalPages)}</p>
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              {hasPrevious ? (
                <PaginationLink href={pageHref(1, q, statusFilter, pageSize)} aria-label={t.brands.goFirst}>
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
                  href={pageHref(currentPage - 1, q, statusFilter, pageSize)}
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
                <PaginationLink href={pageHref(page, q, statusFilter, pageSize)} isActive={page === currentPage}>
                  {page}
                </PaginationLink>
              </PaginationItem>
            ))}
            {desktopPageWindow.map((page) => (
              <PaginationItem key={`d-${page}`} className="hidden sm:block">
                <PaginationLink href={pageHref(page, q, statusFilter, pageSize)} isActive={page === currentPage}>
                  {page}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              {hasNext ? (
                <PaginationNext
                  href={pageHref(currentPage + 1, q, statusFilter, pageSize)}
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
                <PaginationLink href={pageHref(totalPages, q, statusFilter, pageSize)} aria-label={t.brands.goLast}>
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
