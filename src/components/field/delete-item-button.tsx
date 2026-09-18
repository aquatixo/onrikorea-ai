"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteStoreVisitItem } from "@/app/(dashboard)/field/store-visits/actions";
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
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant={size === "sm" ? "destructive" : "ghost"}
      size={size}
      disabled={isPending}
      aria-label={t.delete}
      onClick={(e) => {
        e.stopPropagation();
        if (!confirm(t.confirmDelete)) return;
        startTransition(() => deleteStoreVisitItem(storeVisitId, itemId));
      }}
    >
      <Trash2 className={size === "sm" ? "size-4" : "size-4 text-destructive"} /> {size === "sm" ? t.delete : null}
    </Button>
  );
}
