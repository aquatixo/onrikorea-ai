"use client";

import * as React from "react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { runBrandSourcing } from "@/app/(dashboard)/brands/sourcing/actions";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";

export function RunSourcingButton({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function handleRun() {
    setError(null);
    startTransition(async () => {
      const result = await runBrandSourcing();
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-2">
      <Button onClick={handleRun} disabled={isPending}>
        {isPending ? t.sourcing.running : t.sourcing.runButton}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
