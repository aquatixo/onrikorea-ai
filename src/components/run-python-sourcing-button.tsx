"use client";

import * as React from "react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { runPythonBrandSourcing } from "@/app/brands/sourcing/python-actions";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";

export function RunPythonSourcingButton({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [output, setOutput] = React.useState<string | null>(null);

  function handleRun() {
    setError(null);
    setOutput(null);
    startTransition(async () => {
      const result = await runPythonBrandSourcing();
      if (result.error) setError(result.error);
      if (result.output) setOutput(result.output);
    });
  }

  return (
    <div className="space-y-2">
      <Button variant="outline" onClick={handleRun} disabled={isPending}>
        {isPending ? t.sourcing.runningPython : t.sourcing.runPythonButton}
      </Button>
      {error && <p className="whitespace-pre-wrap text-sm text-destructive">{error}</p>}
      {output && (
        <pre className="max-h-48 overflow-y-auto rounded-lg border border-border bg-muted/50 p-3 text-xs whitespace-pre-wrap">
          {output}
        </pre>
      )}
    </div>
  );
}
