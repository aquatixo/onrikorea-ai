"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setStoreVisitStatus } from "@/app/(dashboard)/field/store-visits/actions";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";
import type { StoreVisitStatus } from "@prisma/client";

export function VisitStatusControl({
  visitId,
  status,
  locale,
}: {
  visitId: string;
  status: StoreVisitStatus;
  locale: Locale;
}) {
  const t = getDictionary(locale).field.visits;
  const [isPending, startTransition] = useTransition();

  const next: StoreVisitStatus = status === "COMPLETED" ? "IN_PROGRESS" : "COMPLETED";

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() => startTransition(() => setStoreVisitStatus(visitId, next))}
    >
      {status === "COMPLETED" ? t.reopen : t.complete}
    </Button>
  );
}
