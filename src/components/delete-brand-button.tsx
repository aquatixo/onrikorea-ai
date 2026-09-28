"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteBrand } from "@/app/(dashboard)/brands/actions";

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
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="destructive"
      disabled={isPending}
      onClick={() => {
        if (!confirm(confirmText)) return;
        startTransition(async () => {
          const result = await deleteBrand(brandId, returnTo);
          if (result?.error) alert(result.error);
        });
      }}
    >
      <Trash2 className="size-4" /> {label}
    </Button>
  );
}
