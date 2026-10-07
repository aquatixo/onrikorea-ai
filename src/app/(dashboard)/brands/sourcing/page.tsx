import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { RunPythonSourcingButton } from "@/components/run-python-sourcing-button";
import { SourcingBackendStatus } from "@/components/sourcing-backend-status";
import type { SourcingProgress } from "@/components/sourcing-progress-panel";
import { SourcingResultsTable } from "@/components/sourcing-results-table";
import { DAILY_CANDIDATE_TARGET, DAILY_SEARCH_BUDGET } from "@/lib/brand-sourcing/daily-limits";
import { Search, ListChecks } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BrandSourcingPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);

  // Local calendar date, matching python-sourcing/main.py's date.today() -- both run on
  // the same machine, so local system date agrees between the two.
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

  // Separate queries on purpose: each button/progress panel only cares about the most
  // recent run for ITS OWN backend (Serper and Tavily run independently, see
  // SourcingLaneState/SourcingDailyBudget), but the review table shows every still-
  // pending candidate across every run and every backend -- daily runs now accumulate
  // candidates over several days instead of one run's results replacing the last, so
  // showing only the latest run's candidates would silently hide yesterday's unreviewed
  // ones the moment a new run starts.
  //
  // Today's SourcingDailyBudget is fetched separately (not derived from latestRun's
  // progress) specifically so the status card stays honest when no one has run today
  // yet -- latestRun.progress would otherwise show yesterday's finished totals as if
  // they were today's, which is exactly the confusion that prompted this card to exist.
  const [latestSerperRun, latestTavilyRun, candidates, serperBudget, tavilyBudget] = await Promise.all([
    db.sourcingRun.findFirst({ where: { backend: "serper" }, orderBy: { createdAt: "desc" } }),
    db.sourcingRun.findFirst({ where: { backend: "tavily" }, orderBy: { createdAt: "desc" } }),
    db.sourcingCandidate.findMany({ orderBy: [{ verdict: "asc" }, { name: "asc" }] }),
    db.sourcingDailyBudget.findUnique({ where: { backend_runDate: { backend: "serper", runDate: today } } }),
    db.sourcingDailyBudget.findUnique({ where: { backend_runDate: { backend: "tavily", runDate: today } } }),
  ]);

  const lastRunAt = [latestSerperRun?.createdAt, latestTavilyRun?.createdAt]
    .filter((d): d is Date => d != null)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

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

      <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <SourcingBackendStatus
            label="Serper"
            searchUsed={serperBudget?.searchUsed ?? 0}
            searchBudget={DAILY_SEARCH_BUDGET.serper}
            candidatesOut={serperBudget?.candidatesOut ?? 0}
            candidateTarget={DAILY_CANDIDATE_TARGET.serper}
            stoppedBy={serperBudget?.stoppedBy ?? null}
            lastRunAt={latestSerperRun?.createdAt ?? null}
            locale={locale}
          />
          <SourcingBackendStatus
            label="Tavily"
            searchUsed={tavilyBudget?.searchUsed ?? 0}
            searchBudget={DAILY_SEARCH_BUDGET.tavily}
            candidatesOut={tavilyBudget?.candidatesOut ?? 0}
            candidateTarget={DAILY_CANDIDATE_TARGET.tavily}
            stoppedBy={tavilyBudget?.stoppedBy ?? null}
            lastRunAt={latestTavilyRun?.createdAt ?? null}
            locale={locale}
          />
        </div>
        <div className="flex flex-wrap items-start gap-3">
          <RunPythonSourcingButton
            locale={locale}
            backend="serper"
            label={t.sourcing.runPythonButtonServer}
            latestRun={
              latestSerperRun
                ? {
                    id: latestSerperRun.id,
                    status: latestSerperRun.status,
                    progress: latestSerperRun.progress as SourcingProgress | null,
                  }
                : null
            }
          />
          <RunPythonSourcingButton
            locale={locale}
            backend="tavily"
            label={t.sourcing.runPythonButtonTavily}
            latestRun={
              latestTavilyRun
                ? {
                    id: latestTavilyRun.id,
                    status: latestTavilyRun.status,
                    progress: latestTavilyRun.progress as SourcingProgress | null,
                  }
                : null
            }
          />
        </div>
      </div>

      {candidates.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
          <ListChecks className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t.sourcing.noRunsYet}</p>
        </div>
      ) : (
        <SourcingResultsTable
          lastRunAt={lastRunAt}
          candidates={candidates}
          verdictLabel={verdictLabel}
          locale={locale}
        />
      )}
    </main>
  );
}
