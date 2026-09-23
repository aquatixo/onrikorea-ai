"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PRODUCT_CATEGORY_VALUES } from "@/lib/field-status";
import { compressImages } from "@/lib/compress-image";
import type { ItemFormState } from "@/app/(dashboard)/field/store-visits/actions";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";
import type { Product, StoreVisit, Store } from "@prisma/client";

const initialState: ItemFormState = {};

export function StoreVisitItemForm({
  item,
  visits,
  locale,
  action,
}: {
  item?: Product;
  // Only passed when creating from the global Products page, where the visit isn't
  // already implied by the URL -- renders a required visit picker at the top of the form.
  visits?: (StoreVisit & { store: Store })[];
  locale: Locale;
  action: (prevState: ItemFormState, formData: FormData) => Promise<ItemFormState>;
}) {
  const t = getDictionary(locale).field;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const router = useRouter();
  const [isCompressing, setIsCompressing] = React.useState(false);

  // Photos come off the native file input, get compressed client-side, then get handed to
  // the Server Action manually -- useActionState's formAction is a plain function, so it's
  // fine to call it with a rebuilt FormData instead of letting the form submit natively.
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

    React.startTransition(() => {
      formAction(formData);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {state.message && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.message}
        </p>
      )}

      {visits && (
        <div className="space-y-1.5">
          <label htmlFor="storeVisitId" className="text-sm font-medium">
            {t.products.visitLabel}
            <span className="text-destructive"> *</span>
          </label>
          <select
            id="storeVisitId"
            name="storeVisitId"
            required
            defaultValue=""
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
          >
            <option value="">{t.choosePlaceholder}</option>
            {visits.map((v) => (
              <option key={v.id} value={v.id}>
                {v.store.name} · {new Date(v.visitDate).toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US")}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label={t.products.brandNameLabel}
          name="brandName"
          defaultValue={item?.brandName ?? ""}
          error={state.errors?.brandName}
        />
        <Field
          label={t.products.productNameLabel}
          name="productName"
          required
          defaultValue={item?.productName ?? ""}
          error={state.errors?.productName}
        />
        <div className="space-y-1.5">
          <label htmlFor="category" className="text-sm font-medium">
            {t.products.categoryLabel}
          </label>
          <select
            id="category"
            name="category"
            defaultValue={item?.category ?? "OTHER"}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
          >
            {PRODUCT_CATEGORY_VALUES.map((v) => (
              <option key={v} value={v}>
                {t.category[v]}
              </option>
            ))}
          </select>
        </div>
        <Field label={t.products.subcategoryLabel} name="subcategory" defaultValue={item?.subcategory ?? ""} />
        <Field label={t.products.barcodeLabel} name="barcode" defaultValue={item?.barcode ?? ""} />
        <Field
          label={t.products.countryOfOriginLabel}
          name="countryOfOrigin"
          defaultValue={item?.countryOfOrigin ?? ""}
        />
        <Field label={t.products.manufacturerLabel} name="manufacturer" defaultValue={item?.manufacturer ?? ""} />
        <Field label={t.products.packageSizeLabel} name="packageSize" defaultValue={item?.packageSize ?? ""} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label={t.addItem.priceLabel}
          name="price"
          type="number"
          defaultValue={item?.price?.toString() ?? ""}
          error={state.errors?.price}
        />
        <Field label={t.addItem.promotionLabel} name="promotion" defaultValue={item?.promotion ?? ""} />
        <Field label={t.addItem.stockStatusLabel} name="stockStatus" defaultValue={item?.stockStatus ?? ""} />
        <Field
          label={t.addItem.displayLocationLabel}
          name="displayLocation"
          defaultValue={item?.displayLocation ?? ""}
        />
        <Field
          label={t.addItem.facingCountLabel}
          name="facingCount"
          type="number"
          defaultValue={item?.facingCount?.toString() ?? ""}
          error={state.errors?.facingCount}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">{t.addItem.memoLabel}</label>
        <textarea
          name="memo"
          rows={2}
          defaultValue={item?.memo ?? ""}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">{t.addItem.photosLabel}</label>
        <input
          type="file"
          name="photos"
          accept="image/*"
          multiple
          className="block text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-accent"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending || isCompressing}>
          {isPending || isCompressing ? t.addItem.saving : t.addItem.save}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          {t.cancel}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  error,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  error?: string[];
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        min={type === "number" ? 0 : undefined}
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
      />
      {error && <p className="text-xs text-destructive">{error[0]}</p>}
    </div>
  );
}
