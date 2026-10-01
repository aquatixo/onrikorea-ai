"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteStoreVisitPhoto } from "@/app/(dashboard)/field/store-visits/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
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
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [isPending, startTransition] = useTransition();

  return (
    <>
      {confirmDialog}
      <button
        type="button"
        disabled={isPending}
        aria-label={t.deletePhoto}
        onClick={async (e) => {
          e.stopPropagation();
          if (!(await confirm({ description: t.confirmDeletePhoto, destructive: true }))) return;
          startTransition(async () => {
            const result = await deleteStoreVisitPhoto(photoId, storeVisitId);
            if (result?.error) await confirm({ description: result.error, alertOnly: true });
          });
        }}
        className="flex size-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
      >
        <Trash2 className="size-3.5" />
      </button>
    </>
  );
}
