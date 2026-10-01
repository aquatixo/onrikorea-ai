"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setStoreVisitStatus } from "@/app/(dashboard)/field/store-visits/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";
import type { StoreVisitStatus } from "@prisma/client";

export function VisitStatusControl({
  visitId,
  status,
  locale,
  canModify,
}: {
  visitId: string;
  status: StoreVisitStatus;
  locale: Locale;
  canModify: boolean;
}) {
  const t = getDictionary(locale).field.visits;
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [isPending, startTransition] = useTransition();

  const next: StoreVisitStatus = status === "COMPLETED" ? "IN_PROGRESS" : "COMPLETED";

  if (!canModify) return null;

  return (
    <>
      {confirmDialog}
      <Button
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const result = await setStoreVisitStatus(visitId, next);
            if (result?.error) await confirm({ description: result.error, alertOnly: true });
          })
        }
      >
        {status === "COMPLETED" ? t.reopen : t.complete}
      </Button>
    </>
  );
}
