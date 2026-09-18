"use client";

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
  const deleteAction = deleteBrand.bind(null, brandId, returnTo);

  return (
    <form
      action={deleteAction}
      onSubmit={(e) => {
        if (!confirm(confirmText)) {
          e.preventDefault();
        }
      }}
    >
      <Button type="submit" variant="destructive">
        <Trash2 className="size-4" /> {label}
      </Button>
    </form>
  );
}
