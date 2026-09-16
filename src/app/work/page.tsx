import Link from "next/link";
import { Plus, ChevronsLeft, ChevronsRight } from "lucide-react";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { getPageWindow, parsePageSize } from "@/lib/pagination";
import { WORK_STATUS_STYLE } from "@/lib/work-status";
import { WorkSearch } from "@/components/work-search";
import { PageSizeControl } from "@/components/page-size-control";
import { AddPersonForm } from "@/components/add-person-form";
import { UserAvatar } from "@/components/user-avatar";
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

const ETC_ASSIGNEE = "기타";

function pageHref(page: number, assignee: string, category: string, q: string, pageSize: number) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  if (assignee) params.set("assignee", assignee);
  if (category) params.set("category", category);
  if (q) params.set("q", q);
  params.set("pageSize", String(pageSize));
  return `/work?${params.toString()}`;
}

function assigneeHref(name: string, category: string, pageSize: number) {
  const params = new URLSearchParams();
  if (name) params.set("assignee", name);
  if (category) params.set("category", category);
  params.set("pageSize", String(pageSize));
  return `/work?${params.toString()}`;
}

export const dynamic = "force-dynamic";

export default async function WorkPage(props: {
  searchParams: Promise<{ assignee?: string; category?: string; q?: string; page?: string; pageSize?: string }>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const searchParams = await props.searchParams;

  const assignee = (searchParams.assignee ?? "").trim();
  const category = (searchParams.category ?? "").trim();
  const q = (searchParams.q ?? "").trim();
  const pageSize = parsePageSize(searchParams.pageSize);
  const parsedPage = Number.parseInt(searchParams.page ?? "1", 10);
  const currentPage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const where: Prisma.WorkItemWhereInput = {
    ...(assignee ? { assigneeName: assignee } : {}),
    ...(category ? { category } : {}),
    ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
  };

  const [people, etcCategories, total, items] = await Promise.all([
    db.person.findMany({ orderBy: { name: "asc" } }),
    db.workItem.findMany({
      where: { assigneeName: ETC_ASSIGNEE },
      distinct: ["category"],
      select: { category: true },
      orderBy: { category: "asc" },
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
        <nav className="shrink-0 space-y-0.5 rounded-2xl border border-border bg-card p-2 shadow-sm sm:w-52">
          <Link
            href={assigneeHref("", "", pageSize)}
            className={cn(
              "block rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              !assignee ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {t.work.allAssignees}
          </Link>
          {people.map((person) => (
            <Link
              key={person.id}
              href={assigneeHref(person.name, "", pageSize)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                assignee === person.name && !category
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              <UserAvatar name={person.name} size="sm" />
              {person.name}
            </Link>
          ))}

          {etcCategories.length > 0 && (
            <>
              <Link
                href={assigneeHref(ETC_ASSIGNEE, "", pageSize)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  assignee === ETC_ASSIGNEE && !category
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                <UserAvatar name={ETC_ASSIGNEE} size="sm" />
                {t.work.etcLabel}
              </Link>
              <div className="ml-3.5 flex flex-col gap-0.5 border-l border-border pl-3">
                {etcCategories.map(({ category: etcCategory }) => (
                  <Link
                    key={etcCategory}
                    href={assigneeHref(ETC_ASSIGNEE, etcCategory ?? "", pageSize)}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                      assignee === ETC_ASSIGNEE && category === etcCategory
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {etcCategory}
                  </Link>
                ))}
              </div>
            </>
          )}

          <div className="pt-1">
            <AddPersonForm locale={locale} />
          </div>
        </nav>

        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <WorkSearch defaultValue={q} placeholder={t.work.searchPlaceholder} />
            <PageSizeControl value={pageSize} label={t.work.rowsPerPage} />
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="divide-y divide-border">
              {items.length === 0 && (
                <p className="p-8 text-center text-sm text-muted-foreground">{t.work.noItemsFound}</p>
              )}
              {items.map((item) => (
                <Link
                  key={item.id}
                  href={`/work/${item.id}?returnTo=${encodeURIComponent(pageHref(currentPage, assignee, category, q, pageSize))}`}
                  style={{ borderLeftColor: item.color || "transparent" }}
                  className="flex items-center gap-3 border-l-4 px-4 py-3 transition-colors hover:bg-muted/50"
                >
                  <UserAvatar name={item.assigneeName} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{item.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.assigneeName}
                      {item.category ? ` · ${item.category}` : ""}
                    </p>
                  </div>
                  <Badge className={cn(WORK_STATUS_STYLE[item.status], "shrink-0")}>
                    {t.work.status[item.status]}
                  </Badge>
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
                      <PaginationLink href={pageHref(1, assignee, category, q, pageSize)} aria-label={t.brands.goFirst}>
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
                      <PaginationPrevious href={pageHref(currentPage - 1, assignee, category, q, pageSize)} text="" />
                    ) : (
                      <PaginationPrevious href="#" aria-disabled text="" className="pointer-events-none opacity-50" />
                    )}
                  </PaginationItem>
                  {pageWindow.map((page) => (
                    <PaginationItem key={page}>
                      <PaginationLink href={pageHref(page, assignee, category, q, pageSize)} isActive={page === currentPage}>
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    {hasNext ? (
                      <PaginationNext href={pageHref(currentPage + 1, assignee, category, q, pageSize)} text="" />
                    ) : (
                      <PaginationNext href="#" aria-disabled text="" className="pointer-events-none opacity-50" />
                    )}
                  </PaginationItem>
                  <PaginationItem>
                    {hasNext ? (
                      <PaginationLink href={pageHref(totalPages, assignee, category, q, pageSize)} aria-label={t.brands.goLast}>
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
