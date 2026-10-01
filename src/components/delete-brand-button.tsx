"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteBrand } from "@/app/(dashboard)/brands/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";

export function DeleteBrandButton({
  brandId,
  label,
  confirmText,
  returnTo,
}: {
  brandId: string;
  label: string;
  confirmText: string;
  returnTo?: string;
}) {
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [isPending, startTransition] = useTransition();

  return (
    <>
      {confirmDialog}
      <Button
        type="button"
        variant="destructive"
        disabled={isPending}
        onClick={async () => {
          if (!(await confirm({ description: confirmText, destructive: true }))) return;
          startTransition(async () => {
            const result = await deleteBrand(brandId, returnTo);
            if (result?.error) await confirm({ description: result.error, alertOnly: true });
          });
        }}
      >
        <Trash2 className="size-4" /> {label}
      </Button>
    </>
  );
}
