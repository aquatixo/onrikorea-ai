"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteWork } from "@/app/(dashboard)/work/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";

export function DeleteWorkButton({
  workItemId,
  returnTo,
  locale,
}: {
  workItemId: string;
  returnTo?: string;
  locale: Locale;
}) {
  const t = getDictionary(locale).work.detail;
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [isPending, startTransition] = useTransition();

  return (
    <>
      {confirmDialog}
      <Button
        variant="destructive"
        size="sm"
        disabled={isPending}
        onClick={async () => {
          if (!(await confirm({ description: t.confirmDelete, destructive: true }))) return;
          startTransition(async () => {
            const result = await deleteWork(workItemId, returnTo);
            if (result?.error) await confirm({ description: result.error, alertOnly: true });
          });
        }}
      >
        <Trash2 className="size-4" /> {t.delete}
      </Button>
    </>
  );
}
