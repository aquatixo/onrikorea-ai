"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteWork } from "@/app/(dashboard)/work/actions";
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
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="destructive"
      size="sm"
      disabled={isPending}
      onClick={() => {
        if (!confirm(t.confirmDelete)) return;
        startTransition(() => deleteWork(workItemId, returnTo));
      }}
    >
      <Trash2 className="size-4" /> {t.delete}
    </Button>
  );
}
