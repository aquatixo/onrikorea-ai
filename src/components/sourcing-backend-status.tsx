import { cn } from "cn";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";
import { formatDateTime } from "@/lib/format-date";

/**
 * Always-visible "where do things stand right now" card for one search backend --
 * shown regardless of whether a run is currently active, so the user can tell BEFORE
 * clicking whether today's budget/target is already spent (in which case running again
 * would stop almost immediately with 0 new candidates) instead of finding out only after
 * clicking and getting confused by an empty-looking result.
 */
export function SourcingBackendStatus({
  label,
  searchUsed,
  searchBudget,
  candidatesOut,
  candidateTarget,
  stoppedBy,
  lastRunAt,
  locale,
}: {
  label: string;
  searchUsed: number;
  searchBudget: number;
  candidatesOut: number;
  candidateTarget: number;
  stoppedBy: string | null;
  lastRunAt: Date | null;
  locale: Locale;
}) {
  const t = getDictionary(locale).sourcing;
  const budgetSpent = searchUsed >= searchBudget;
  const targetReached = candidatesOut >= candidateTarget;

  return (
    <div className="min-w-[220px] flex-1 space-y-2 rounded-xl border border-border bg-muted/30 p-3">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      <div className="space-y-1.5 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">{t.progressLabel.searchUsedToday}</span>
          <span className={cn("font-semibold tabular-nums", budgetSpent && "text-destructive")}>
            {searchUsed} / {searchBudget}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">{t.progressLabel.candidatesToday}</span>
          <span className={cn("font-semibold tabular-nums", targetReached && "text-emerald-600 dark:text-emerald-400")}>
            {candidatesOut} / {candidateTarget}
          </span>
        </div>
      </div>
      {stoppedBy && (
        <p className="text-xs text-muted-foreground">
          {t.stoppedByLabel[stoppedBy as keyof typeof t.stoppedByLabel] ?? stoppedBy}
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">
        {lastRunAt ? `${t.lastRunAt}: ${formatDateTime(lastRunAt, locale)}` : t.noRunsToday}
      </p>
    </div>
  );
}
