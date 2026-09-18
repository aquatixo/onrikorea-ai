"use client";

import * as React from "react";
import { useTransition } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadStoreVisitPhoto } from "@/app/(dashboard)/field/store-visits/actions";
import { PHOTO_TYPE_VALUES } from "@/lib/field-status";
import { compressImages } from "@/lib/compress-image";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";

export function UploadStorePhotoForm({ storeVisitId, locale }: { storeVisitId: string; locale: Locale }) {
  const t = getDictionary(locale).field;
  const [isPending, startTransition] = useTransition();
  const [isCompressing, setIsCompressing] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fileInput = form.elements.namedItem("photos") as HTMLInputElement | null;
    const rawFiles = fileInput?.files ? Array.from(fileInput.files) : [];

    setIsCompressing(true);
    const compressed = await compressImages(rawFiles);
    setIsCompressing(false);

    const formData = new FormData(form);
    formData.delete("photos");
    for (const file of compressed) formData.append("photos", file);

    startTransition(async () => {
      const result = await uploadStoreVisitPhoto(storeVisitId, formData);
      if (result.error) return;
      formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">{t.visits.photoTypeLabel}</label>
        <select
          name="photoType"
          defaultValue="STORE"
          className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring/50"
        >
          {PHOTO_TYPE_VALUES.map((v) => (
            <option key={v} value={v}>
              {t.photoType[v]}
            </option>
          ))}
        </select>
      </div>
      <input
        type="file"
        name="photos"
        accept="image/*"
        capture="environment"
        multiple
        required
        className="block text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-accent"
      />
      <Button type="submit" size="sm" variant="outline" disabled={isPending || isCompressing}>
        <Upload className="size-3.5" /> {isPending || isCompressing ? t.visits.uploading : t.visits.upload}
      </Button>
    </form>
  );
}
