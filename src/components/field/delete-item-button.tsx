"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteStoreVisitItem } from "@/app/(dashboard)/field/store-visits/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";

export function DeleteItemButton({
  storeVisitId,
  itemId,
  locale,
  size = "icon-sm",
}: {
  storeVisitId: string;
  itemId: string;
  locale: Locale;
  size?: "icon-sm" | "sm";
}) {
  const t = getDictionary(locale).field.itemDetail;
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [isPending, startTransition] = useTransition();

  return (
    <>
      {confirmDialog}
      <Button
        variant={size === "sm" ? "destructive" : "ghost"}
        size={size}
        disabled={isPending}
        aria-label={t.delete}
        onClick={async (e) => {
          e.stopPropagation();
          if (!(await confirm({ description: t.confirmDelete, destructive: true }))) return;
          startTransition(async () => {
            const result = await deleteStoreVisitItem(storeVisitId, itemId);
            if (result?.error) await confirm({ description: result.error, alertOnly: true });
          });
        }}
      >
        <Trash2 className={size === "sm" ? "size-4" : "size-4 text-destructive"} /> {size === "sm" ? t.delete : null}
      </Button>
    </>
  );
}
