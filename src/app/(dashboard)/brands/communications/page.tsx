import Link from "next/link";
import { ChevronsLeft, ChevronsRight, LayoutList, Rows3 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
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
import { CommunicationsOverview } from "@/components/communications-overview";
import { db } from "@/lib/db";
import { STATUS_STYLE } from "@/lib/brand-status";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { getPageWindow, parsePageSize, parsePage } from "@/lib/pagination";
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

/** "한눈에 보기": the same filters, every match on one page -- no page/pageSize. */
function overviewHref(q: string, status: string) {
  const params = new URLSearchParams();
  params.set("view", "all");
  if (q) params.set("q", q);
  if (status !== "ALL") params.set("status", status);
  return `/brands/communications?${params.toString()}`;
}

export default async function BrandCommunicationsPage(props: {
  searchParams: Promise<{ status?: string; q?: string; page?: string; pageSize?: string; view?: string }>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const { status: rawStatus, q: rawQ, page: rawPage, pageSize: rawPageSize, view } = await props.searchParams;
  const overview = view === "all";
  const statusFilter = rawStatus === "REPLIED" || rawStatus === "CONTACTED" ? rawStatus : "ALL";
  const q = (rawQ ?? "").trim();

  const currentPage = parsePage(rawPage);
  const pageSize = parsePageSize(rawPageSize);

  // "Actively tracked" is defined by having a progress log, not by status -- status
  // alone would also match brands from months-old outreach that are no longer being
  // worked, since it's never reset once set (see BrandLog's schema comment).
  // Dropped brands are ones the team gave up on, so they leave this page even though
  // their log history stays on the brand itself.
  const where: Prisma.BrandWhereInput = {
    logs: { some: {} },
    status: { not: "DROPPED" },
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

  // Brand name order -- A-Z then 가나다 -- in both views, the way the team's old sheet was
  // read, so a brand doesn't jump around every time someone adds a note. Sorted in JS
  // rather than by the database so case and accents don't split the order ("en" puts
  // Latin before Hangul; "ko" would do the reverse); the matching set is small (brands
  // actively worked, not the full 1000+ list), so fetching it whole and paginating in JS
  // is cheap. The overview needs every log (oldest first, read as a timeline); the paged
  // list only shows the latest one.
  const matched = await db.brand.findMany({
    where,
    include: overview
      ? { logs: { orderBy: { createdAt: "asc" } } }
      : { logs: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  matched.sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base", numeric: true }));

  const total = matched.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const brands = matched.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const hasPrevious = currentPage > 1;
  const hasNext = currentPage < totalPages;
  const mobilePageWindow = getPageWindow(currentPage, totalPages, 3);
  const desktopPageWindow = getPageWindow(currentPage, totalPages, 10);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-6 py-10 sm:px-8 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.communications.title}</h1>
          <p className="text-sm text-muted-foreground">{t.communications.countTracked(total)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!overview && <PageSizeControl value={pageSize} label={t.brands.rowsPerPage} />}
          <BrandSearch defaultValue={q} placeholder={t.brands.searchPlaceholder} />
          <CommunicationStatusFilter value={statusFilter} locale={locale} />
          {overview ? (
            <Link href={pageHref(1, q, statusFilter, pageSize)} className={buttonVariants({ variant: "outline" })}>
              <LayoutList className="size-4" />
              {t.communications.listView}
            </Link>
          ) : (
            <Link href={overviewHref(q, statusFilter)} className={buttonVariants({ variant: "outline" })}>
              <Rows3 className="size-4" />
              {t.communications.overview}
            </Link>
          )}
        </div>
      </div>

      {overview ? (
        <CommunicationsOverview brands={matched} locale={locale} returnTo={overviewHref(q, statusFilter)} />
      ) : (
        <>

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
        </>
      )}
    </main>
  );
}
