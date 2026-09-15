import Link from "next/link";
import { Plus, ChevronsLeft, ChevronsRight } from "lucide-react";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { getPageWindow, parsePageSize } from "@/lib/pagination";
import { WORK_STATUS_STYLE } from "@/lib/work-status";
import { WorkSearch } from "@/components/work-search";
import { PageSizeControl } from "@/components/page-size-control";
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
import { cn } from "cn";
import type { Prisma } from "@prisma/client";

function pageHref(page: number, assignee: string, q: string, pageSize: number) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  if (assignee) params.set("assignee", assignee);
  if (q) params.set("q", q);
  params.set("pageSize", String(pageSize));
  return `/work?${params.toString()}`;
}

function assigneeHref(name: string, pageSize: number) {
  const params = new URLSearchParams();
  if (name) params.set("assignee", name);
  params.set("pageSize", String(pageSize));
  return `/work?${params.toString()}`;
}

export const dynamic = "force-dynamic";

export default async function WorkPage(props: {
  searchParams: Promise<{ assignee?: string; q?: string; page?: string; pageSize?: string }>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const searchParams = await props.searchParams;

  const assignee = (searchParams.assignee ?? "").trim();
  const q = (searchParams.q ?? "").trim();
  const pageSize = parsePageSize(searchParams.pageSize);
  const parsedPage = Number.parseInt(searchParams.page ?? "1", 10);
  const currentPage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const where: Prisma.WorkItemWhereInput = {
    ...(assignee ? { assigneeName: assignee } : {}),
    ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
  };

  const [assignees, total, items] = await Promise.all([
    db.workItem.findMany({
      distinct: ["assigneeName"],
      select: { assigneeName: true },
      orderBy: { assigneeName: "asc" },
    }),
    db.workItem.count({ where }),
    db.workItem.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (currentPage - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasPrevious = currentPage > 1;
  const hasNext = currentPage < totalPages;
  const pageWindow = getPageWindow(currentPage, totalPages, 10);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-6 py-10 sm:px-8 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.work.title}</h1>
          <p className="text-sm text-muted-foreground">{t.work.subtitle}</p>
        </div>
        <Button
          nativeButton={false}
          render={
            <Link href={assignee ? `/work/new?assignee=${encodeURIComponent(assignee)}` : "/work/new"}>
              <Plus className="size-4" /> {t.work.addWork}
            </Link>
          }
        />
      </div>

      <div className="flex flex-col gap-6 sm:flex-row">
        <nav className="flex shrink-0 flex-wrap gap-1.5 sm:w-44 sm:flex-col sm:flex-nowrap">
          <Link
            href={assigneeHref("", pageSize)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium",
              !assignee ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {t.work.allAssignees}
          </Link>
          {assignees.map(({ assigneeName }) => (
            <Link
              key={assigneeName}
              href={assigneeHref(assigneeName, pageSize)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium",
                assignee === assigneeName
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {assigneeName}
            </Link>
          ))}
        </nav>

        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <WorkSearch defaultValue={q} placeholder={t.work.searchPlaceholder} />
            <PageSizeControl value={pageSize} label={t.work.rowsPerPage} />
          </div>

          <div className="overflow-hidden rounded-xl border border-border">
            <div className="divide-y divide-border">
              {items.length === 0 && (
                <p className="p-8 text-center text-sm text-muted-foreground">{t.work.noItemsFound}</p>
              )}
              {items.map((item) => (
                <Link
                  key={item.id}
                  href={`/work/${item.id}`}
                  style={{ borderLeftColor: item.color ?? "transparent" }}
                  className="flex items-center justify-between gap-4 border-l-4 px-4 py-3 hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.assigneeName}
                      {item.category ? ` · ${item.category}` : ""}
                    </p>
                  </div>
                  <Badge className={WORK_STATUS_STYLE[item.status]}>{t.work.status[item.status]}</Badge>
                </Link>
              ))}
            </div>
          </div>

          {totalPages > 1 && (
            <div className="space-y-2">
              <p className="text-center text-sm text-muted-foreground">
                {t.work.pageOf(currentPage, totalPages)}
              </p>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    {hasPrevious ? (
                      <PaginationLink href={pageHref(1, assignee, q, pageSize)} aria-label={t.brands.goFirst}>
                        <ChevronsLeft className="size-4" />
                      </PaginationLink>
                    ) : (
                      <PaginationLink href="#" aria-disabled className="pointer-events-none opacity-50">
                        <ChevronsLeft className="size-4" />
                      </PaginationLink>
                    )}
                  </PaginationItem>
                  <PaginationItem>
                    {hasPrevious ? (
                      <PaginationPrevious href={pageHref(currentPage - 1, assignee, q, pageSize)} text="" />
                    ) : (
                      <PaginationPrevious href="#" aria-disabled text="" className="pointer-events-none opacity-50" />
                    )}
                  </PaginationItem>
                  {pageWindow.map((page) => (
                    <PaginationItem key={page}>
                      <PaginationLink href={pageHref(page, assignee, q, pageSize)} isActive={page === currentPage}>
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    {hasNext ? (
                      <PaginationNext href={pageHref(currentPage + 1, assignee, q, pageSize)} text="" />
                    ) : (
                      <PaginationNext href="#" aria-disabled text="" className="pointer-events-none opacity-50" />
                    )}
                  </PaginationItem>
                  <PaginationItem>
                    {hasNext ? (
                      <PaginationLink href={pageHref(totalPages, assignee, q, pageSize)} aria-label={t.brands.goLast}>
                        <ChevronsRight className="size-4" />
                      </PaginationLink>
                    ) : (
                      <PaginationLink href="#" aria-disabled className="pointer-events-none opacity-50">
                        <ChevronsRight className="size-4" />
                      </PaginationLink>
                    )}
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
