"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Square } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { stopPythonBrandSourcing } from "@/app/(dashboard)/brands/sourcing/python-actions";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";

export type SourcingProgress = {
  stage?: string;
  stageProgress?: Record<string, number>;
  counts?: Record<string, number>;
  errors?: number;
  message?: string;
};

const STAGE_KEYS = ["discovery", "dedup", "website", "koreaCheck", "scoring"] as const;

const STATUS_STYLE: Record<string, string> = {
  running: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  done: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  stopped: "bg-muted text-muted-foreground",
  error: "bg-destructive/10 text-destructive",
};

export function SourcingProgressPanel({
  runId,
  initialStatus,
  initialProgress,
  locale,
}: {
  runId: string;
  initialStatus: string;
  initialProgress: SourcingProgress | null;
  locale: Locale;
}) {
  const t = getDictionary(locale).sourcing;
  const router = useRouter();
  const [status, setStatus] = React.useState(initialStatus);
  const [progress, setProgress] = React.useState<SourcingProgress | null>(initialProgress);
  const [isStopping, setIsStopping] = React.useState(false);

  React.useEffect(() => {
    if (status !== "running") return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/brands/sourcing-progress?runId=${runId}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        setProgress(data.progress ?? null);
        if (data.status && data.status !== "running") {
          setStatus(data.status);
          router.refresh();
        }
      } catch {
        // transient fetch error -- just try again on the next tick
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [status, runId, router]);

  async function handleStop() {
    setIsStopping(true);
    await stopPythonBrandSourcing(runId);
    setStatus("stopped");
    setIsStopping(false);
    router.refresh();
  }

  const stageProgress = progress?.stageProgress ?? {};
  const counts = progress?.counts ?? {};
  const errors = progress?.errors ?? 0;

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t.runIdLabel} #{runId.slice(0, 8)}
          </p>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
              STATUS_STYLE[status] ?? STATUS_STYLE.running
            )}
          >
            <span className={cn("size-1.5 rounded-full bg-current", status === "running" && "animate-pulse")} />
            {t.statusLabel[status as keyof typeof t.statusLabel] ?? status}
          </span>
        </div>
        {status === "running" && (
          <Button variant="outline" size="sm" onClick={handleStop} disabled={isStopping}>
            <Square className="size-3.5" /> {isStopping ? t.stopping : t.stopButton}
          </Button>
        )}
      </div>

      {status === "error" && progress?.message && (
        <pre className="max-h-40 overflow-auto rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs whitespace-pre-wrap text-destructive">
          {progress.message}
        </pre>
      )}

      <div className="space-y-2.5">
        {STAGE_KEYS.map((key) => (
          <StageBar key={key} label={t.stageLabel[key]} percent={stageProgress[key] ?? 0} />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2.5 border-t border-border pt-4 sm:grid-cols-3">
        <StatChip label={t.countLabel.discovered} value={counts.discovered ?? 0} />
        <StatChip label={t.countLabel.websitesScraped} value={counts.websitesScraped ?? 0} />
        <StatChip label={t.countLabel.koreaChecked} value={counts.koreaChecked ?? 0} />
        <StatChip label={t.countLabel.rejected} value={counts.rejected ?? 0} />
        <StatChip label={t.countLabel.flagged} value={counts.flagged ?? 0} />
        <StatChip label={t.countLabel.skippedCrawl} value={counts.skippedCrawl ?? 0} />
        <StatChip label={t.countLabel.errors} value={errors} warnIfPositive />
      </div>
    </div>
  );
}

function StageBar({ label, percent }: { label: string; percent: number }) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full bg-primary transition-all duration-500", clamped >= 100 && "bg-emerald-500")}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="w-9 shrink-0 text-right text-xs font-semibold tabular-nums text-muted-foreground">
        {clamped}%
      </span>
    </div>
  );
}

function StatChip({
  label,
  value,
  warnIfPositive,
}: {
  label: string;
  value: number;
  warnIfPositive?: boolean;
}) {
  return (
    <div className="rounded-xl bg-muted/40 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn("text-lg font-bold tabular-nums", warnIfPositive && value > 0 && "text-destructive")}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}
