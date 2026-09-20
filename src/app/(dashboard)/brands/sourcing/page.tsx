import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
// TODO: needs ANTHROPIC_API_KEY set in Vercel before this can go live -- re-enable then.
// import { RunSourcingButton } from "@/components/run-sourcing-button";
import { RunPythonSourcingButton } from "@/components/run-python-sourcing-button";
import type { SourcingProgress } from "@/components/sourcing-progress-panel";
import { SourcingResultsTable } from "@/components/sourcing-results-table";
import { Button } from "@/components/ui/button";
import { Search, ListChecks } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BrandSourcingPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);

  const latestRun = await db.sourcingRun.findFirst({
    orderBy: { createdAt: "desc" },
    include: { candidates: { orderBy: [{ verdict: "asc" }, { name: "asc" }] } },
  });

  const verdictLabel: Record<string, string> = {
    pass: t.sourcing.passLabel,
    flag: t.sourcing.flagLabel,
    reject: t.sourcing.rejectLabel,
  };

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-6 py-10 sm:px-8 sm:py-12">
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
          <Search className="size-5 text-primary" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.sourcing.title}</h1>
          <p className="text-sm text-muted-foreground">{t.sourcing.subtitle}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
        {/* TODO: needs ANTHROPIC_API_KEY set in Vercel before this can go live -- swap back to <RunSourcingButton locale={locale} /> then. */}
        <Button disabled>{t.sourcing.runButton}</Button>
        <RunPythonSourcingButton
          locale={locale}
          latestRun={
            latestRun
              ? { id: latestRun.id, status: latestRun.status, progress: latestRun.progress as SourcingProgress | null }
              : null
          }
        />
      </div>

      {!latestRun || latestRun.candidates.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
          <ListChecks className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t.sourcing.noRunsYet}</p>
        </div>
      ) : (
        <SourcingResultsTable
          runId={latestRun.id}
          createdAt={latestRun.createdAt}
          candidates={latestRun.candidates}
          verdictLabel={verdictLabel}
          locale={locale}
        />
      )}
    </main>
  );
}
