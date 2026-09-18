"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteStoreVisit } from "@/app/(dashboard)/field/store-visits/actions";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";

export function DeleteVisitButton({ visitId, locale }: { visitId: string; locale: Locale }) {
  const t = getDictionary(locale).field.visits;
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="destructive"
      size="sm"
      disabled={isPending}
      onClick={() => {
        if (!confirm(t.confirmDelete)) return;
        startTransition(() => deleteStoreVisit(visitId));
      }}
    >
      <Trash2 className="size-4" /> {t.delete}
    </Button>
  );
}
