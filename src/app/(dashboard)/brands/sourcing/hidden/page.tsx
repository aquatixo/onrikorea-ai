import { EyeOff } from "lucide-react";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { SourcingResultsTable } from "@/components/sourcing-results-table";
import { ListPagination } from "@/components/list-pagination";
import { PageSizeControl } from "@/components/page-size-control";
import { parsePage, parsePageSize } from "@/lib/pagination";

export const dynamic = "force-dynamic";

function pageHref(page: number, pageSize: number) {
  return `/brands/sourcing/hidden?page=${page}&pageSize=${pageSize}`;
}

/** Candidates deleted from the review list ("후보 삭제" hides them). Same table as
 * /brands/sourcing, with restore and a link back -- paged, since it only ever grows. */
export default async function HiddenSourcingCandidatesPage(props: PageProps<"/brands/sourcing/hidden">) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const searchParams = await props.searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const currentPage = parsePage(first(searchParams.page));
  const pageSize = parsePageSize(first(searchParams.pageSize));

  const where = { hiddenAt: { not: null } };
  const [total, candidates] = await Promise.all([
    db.sourcingCandidate.count({ where }),
    // Most recently deleted first -- the one you just removed by mistake is at the top.
    db.sourcingCandidate.findMany({
      where,
      orderBy: [{ hiddenAt: "desc" }, { id: "asc" }],
      skip: (currentPage - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const verdictLabel: Record<string, string> = {
    pass: t.sourcing.passLabel,
    flag: t.sourcing.flagLabel,
    reject: t.sourcing.rejectLabel,
  };

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-6 py-10 sm:px-8 sm:py-12">
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-muted">
          <EyeOff className="size-5 text-muted-foreground" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.sourcing.hiddenTitle}</h1>
          <p className="text-sm text-muted-foreground">{t.sourcing.hiddenSubtitle}</p>
        </div>
      </div>

      {/* Keyed by page: ticked rows belong to the page they were ticked on, as in Brands. */}
      <SourcingResultsTable
        key={`${currentPage}-${pageSize}`}
        mode="hidden"
        lastRunAt={null}
        candidates={candidates}
        totalCount={total}
        rowOffset={(currentPage - 1) * pageSize}
        toolbarStart={<PageSizeControl value={pageSize} label={t.brands.rowsPerPage} />}
        verdictLabel={verdictLabel}
        locale={locale}
      />
      {total === 0 ? (
        <p className="text-center text-sm text-muted-foreground">{t.sourcing.noHidden}</p>
      ) : (
        <ListPagination
          currentPage={currentPage}
          totalPages={totalPages}
          hrefFor={(page) => pageHref(page, pageSize)}
          locale={locale}
        />
      )}
    </main>
  );
}
