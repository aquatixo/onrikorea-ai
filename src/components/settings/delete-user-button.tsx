"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteUser } from "@/app/(dashboard)/settings/users/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";

export function DeleteUserButton({ userId, locale }: { userId: string; locale: Locale }) {
  const t = getDictionary(locale).settings.users;
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
            const result = await deleteUser(userId);
            if (result?.error) await confirm({ description: result.error, alertOnly: true });
          });
        }}
      >
        <Trash2 className="size-4 text-destructive" />
      </Button>
    </>
  );
}
