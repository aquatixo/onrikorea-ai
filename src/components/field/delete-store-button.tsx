"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteStore } from "@/app/(dashboard)/field/stores/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";

export function DeleteStoreButton({ storeId, locale }: { storeId: string; locale: Locale }) {
  const t = getDictionary(locale).field.stores;
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [isPending, startTransition] = useTransition();

  return (
    <>
      {confirmDialog}
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={isPending}
        aria-label={t.deleteButton}
        onClick={async () => {
          if (!(await confirm({ description: t.confirmDelete, destructive: true }))) return;
          startTransition(async () => {
            const result = await deleteStore(storeId);
            if (result?.error) await confirm({ description: result.error, alertOnly: true });
          });
        }}
      >
        <Trash2 className="size-4 text-destructive" />
      </Button>
    </>
  );
}
