"use client";

import * as React from "react";
import { X } from "lucide-react";
import { DeletePhotoButton } from "@/components/field/delete-photo-button";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";

type Photo = { id: string; fileUrl: string; fileName: string | null; caption: string | null };

export function PhotoLightbox({
  photos,
  storeVisitId,
  locale,
}: {
  photos: Photo[];
  storeVisitId: string;
  locale: Locale;
}) {
  const t = getDictionary(locale);
  const [openPhoto, setOpenPhoto] = React.useState<Photo | null>(null);

  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
        {photos.map((photo) => (
          <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-lg bg-muted">
            <button
              type="button"
              onClick={() => setOpenPhoto(photo)}
              className="absolute inset-0"
              aria-label={photo.caption ?? photo.fileName ?? "photo"}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- external Vercel Blob URL, no remotePatterns configured */}
              <img src={photo.fileUrl} alt={photo.caption ?? photo.fileName ?? ""} className="size-full object-cover" />
            </button>
            <div className="absolute top-1 right-1 opacity-0 transition-opacity group-hover:opacity-100">
              <DeletePhotoButton photoId={photo.id} storeVisitId={storeVisitId} locale={locale} />
            </div>
          </div>
        ))}
      </div>

      {openPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          onClick={() => setOpenPhoto(null)}
        >
          <button
            type="button"
            onClick={() => setOpenPhoto(null)}
            className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
          <div className="relative max-h-[85vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element -- external Vercel Blob URL, no remotePatterns configured */}
            <img
              src={openPhoto.fileUrl}
              alt={openPhoto.caption ?? openPhoto.fileName ?? ""}
              className="max-h-[85vh] w-auto rounded-lg object-contain"
            />
            {openPhoto.caption && <p className="mt-2 text-center text-sm text-white/80">{openPhoto.caption}</p>}
          </div>
        </div>
      )}

      {photos.length === 0 && <p className="text-sm text-muted-foreground">{t.field.itemDetail.noPhotosYet}</p>}
    </>
  );
}
