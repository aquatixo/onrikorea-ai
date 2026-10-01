"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setStoreActive } from "@/app/(dashboard)/field/stores/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";

export function ToggleStoreActiveButton({
  storeId,
  isActive,
  locale,
}: {
  storeId: string;
  isActive: boolean;
  locale: Locale;
}) {
  const t = getDictionary(locale).field.stores;
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [isPending, startTransition] = useTransition();

  return (
    <>
      {confirmDialog}
      <Button
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={async () => {
          if (isActive && !(await confirm({ description: t.confirmDeactivate, destructive: true }))) return;
          startTransition(async () => {
            const result = await setStoreActive(storeId, !isActive);
            if (result?.error) await confirm({ description: result.error, alertOnly: true });
          });
        }}
      >
        {isActive ? t.deactivate : t.activate}
      </Button>
    </>
  );
}
