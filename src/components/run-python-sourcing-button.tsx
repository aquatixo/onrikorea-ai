"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { SourcingProgressPanel, type SourcingProgress } from "@/components/sourcing-progress-panel";
import { startPythonBrandSourcing } from "@/app/brands/sourcing/python-actions";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";

type LatestRunInfo = { id: string; status: string; progress: SourcingProgress | null } | null;

export function RunPythonSourcingButton({ locale, latestRun }: { locale: Locale; latestRun: LatestRunInfo }) {
  const t = getDictionary(locale);
  const [activeRunId, setActiveRunId] = React.useState<string | null>(
    latestRun && latestRun.status === "running" ? latestRun.id : null
  );
  const [isStarting, setIsStarting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleStart() {
    setError(null);
    setIsStarting(true);
    const result = await startPythonBrandSourcing();
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
      <Button variant="outline" onClick={handleStart} disabled={isStarting}>
        {isStarting ? t.sourcing.runningPython : t.sourcing.runPythonButton}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
