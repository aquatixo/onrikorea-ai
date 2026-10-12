"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { SourcingProgressPanel, type SourcingProgress } from "@/components/sourcing-progress-panel";
import { startPythonBrandSourcing, type SourcingFocus } from "@/app/(dashboard)/brands/sourcing/python-actions";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";

type LatestRunInfo = { id: string; status: string; progress: SourcingProgress | null } | null;
type Backend = "serper" | "tavily";

export function RunPythonSourcingButton({
  locale,
  backend,
  label,
  japanLabel,
  latestRun,
}: {
  locale: Locale;
  backend: Backend;
  label: string;
  // The "일본 집중" run for the same backend. It shares the backend's daily budget, so
  // only one of the two can run at a time -- a running one replaces both buttons.
  japanLabel: string;
  latestRun: LatestRunInfo;
}) {
  const t = getDictionary(locale);
  const [activeRunId, setActiveRunId] = React.useState<string | null>(
    latestRun && latestRun.status === "running" ? latestRun.id : null
  );
  const [isStarting, setIsStarting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleStart(focus?: SourcingFocus) {
    setError(null);
    setIsStarting(true);
    const result = await startPythonBrandSourcing(backend, focus);
    setIsStarting(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setActiveRunId(result.runId);
  }

  if (activeRunId) {
    return (
      <SourcingProgressPanel
        runId={activeRunId}
        initialStatus="running"
        initialProgress={latestRun?.id === activeRunId ? latestRun.progress : null}
        locale={locale}
      />
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => handleStart()} disabled={isStarting}>
          {isStarting ? t.sourcing.runningPython : label}
        </Button>
        <Button variant="outline" onClick={() => handleStart("japan")} disabled={isStarting}>
          {japanLabel}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
