"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteProduct } from "@/app/field/products/actions";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";

export function DeleteProductButton({ productId, locale }: { productId: string; locale: Locale }) {
  const t = getDictionary(locale).field.products;
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
          const result = await deleteProduct(productId);
          if (result?.error) alert(result.error);
        });
      }}
    >
      <Trash2 className="size-4 text-destructive" />
    </Button>
  );
}
