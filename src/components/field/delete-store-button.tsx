"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteStore } from "@/app/(dashboard)/field/stores/actions";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";

export function DeleteStoreButton({ storeId, locale }: { storeId: string; locale: Locale }) {
  const t = getDictionary(locale).field.stores;
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={isPending}
      aria-label={t.deleteButton}
      onClick={() => {
        if (!confirm(t.confirmDelete)) return;
        startTransition(async () => {
          const result = await deleteStore(storeId);
          if (result?.error) alert(result.error);
        });
      }}
    >
      <Trash2 className="size-4 text-destructive" />
    </Button>
  );
}
