"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setStoreActive } from "@/app/field/stores/actions";
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
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() => {
        if (isActive && !confirm(t.confirmDeactivate)) return;
        startTransition(() => setStoreActive(storeId, !isActive));
      }}
    >
      {isActive ? t.deactivate : t.activate}
    </Button>
  );
}
