import { ChevronsLeft, ChevronsRight } from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";
import { getPageWindow } from "@/lib/pagination";

/** "N페이지 중 M페이지" plus first/previous/numbers/next/last links -- the same controls as
 * the Brands list, for a server-rendered list paged with ?page=&pageSize=. */
export function ListPagination({
  currentPage,
  totalPages,
  hrefFor,
  locale,
}: {
  currentPage: number;
  totalPages: number;
  hrefFor: (page: number) => string;
  locale: Locale;
}) {
  const t = getDictionary(locale).brands;
  const hasPrevious = currentPage > 1;
  const hasNext = currentPage < totalPages;
  const disabled = { href: "#", "aria-disabled": true, className: "pointer-events-none opacity-50" } as const;

  return (
    <div className="space-y-2">
      <p className="text-center text-sm text-muted-foreground">{t.pageOf(currentPage, totalPages)}</p>
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationLink {...(hasPrevious ? { href: hrefFor(1) } : disabled)} aria-label={t.goFirst}>
              <ChevronsLeft className="size-4" />
            </PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationPrevious
              {...(hasPrevious ? { href: hrefFor(currentPage - 1) } : disabled)}
              text=""
              aria-label={t.goPrevious}
            />
          </PaginationItem>
          {getPageWindow(currentPage, totalPages, 3).map((page) => (
            <PaginationItem key={`m-${page}`} className="sm:hidden">
              <PaginationLink href={hrefFor(page)} isActive={page === currentPage}>
                {page}
              </PaginationLink>
            </PaginationItem>
          ))}
          {getPageWindow(currentPage, totalPages, 10).map((page) => (
            <PaginationItem key={`d-${page}`} className="hidden sm:block">
              <PaginationLink href={hrefFor(page)} isActive={page === currentPage}>
                {page}
              </PaginationLink>
            </PaginationItem>
          ))}
          <PaginationItem>
            <PaginationNext
              {...(hasNext ? { href: hrefFor(currentPage + 1) } : disabled)}
              text=""
              aria-label={t.goNext}
            />
          </PaginationItem>
          <PaginationItem>
            <PaginationLink {...(hasNext ? { href: hrefFor(totalPages) } : disabled)} aria-label={t.goLast}>
              <ChevronsRight className="size-4" />
            </PaginationLink>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
