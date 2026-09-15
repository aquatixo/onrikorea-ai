"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteBrand } from "@/app/brands/actions";

export function DeleteBrandButton({
  brandId,
  label,
  confirmText,
}: {
  brandId: string;
  label: string;
  confirmText: string;
}) {
  const deleteAction = deleteBrand.bind(null, brandId);

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
