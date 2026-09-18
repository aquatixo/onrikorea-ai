"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteStoreVisitPhoto } from "@/app/(dashboard)/field/store-visits/actions";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";

export function DeletePhotoButton({
  photoId,
  storeVisitId,
  locale,
}: {
  photoId: string;
  storeVisitId: string;
  locale: Locale;
}) {
  const t = getDictionary(locale).field.itemDetail;
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      aria-label={t.deletePhoto}
      onClick={(e) => {
        e.stopPropagation();
        if (!confirm(t.confirmDeletePhoto)) return;
        startTransition(() => deleteStoreVisitPhoto(photoId, storeVisitId));
      }}
      className="flex size-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
    >
      <Trash2 className="size-3.5" />
    </button>
  );
}
