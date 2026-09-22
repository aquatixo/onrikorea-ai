"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PRODUCT_CATEGORY_VALUES, PHOTO_TYPE_VALUES } from "@/lib/field-status";
import { compressImages } from "@/lib/compress-image";
import type { ItemFormState } from "@/app/(dashboard)/field/store-visits/actions";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";
import type { Product, StoreVisitItem } from "@prisma/client";

const initialState: ItemFormState = {};

export function StoreVisitItemForm({
  mode,
  products,
  item,
  locale,
  action,
}: {
  mode: "create" | "update";
  products?: Product[];
  item?: StoreVisitItem & { product?: Product };
  locale: Locale;
  action: (prevState: ItemFormState, formData: FormData) => Promise<ItemFormState>;
}) {
  const t = getDictionary(locale).field;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const router = useRouter();
  const [creatingNew, setCreatingNew] = React.useState(false);
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

      {mode === "create" ? (
        <>
          <div className="space-y-1.5">
            <label htmlFor="productId" className="text-sm font-medium">
              {t.addItem.pickExisting}
            </label>
            <select
              id="productId"
              name="productId"
              disabled={creatingNew}
              defaultValue=""
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 disabled:opacity-50"
            >
              <option value="">{t.choosePlaceholder}</option>
              {(products ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.brandName} · {p.productName}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setCreatingNew((v) => !v)}
            className="text-xs font-medium text-primary hover:underline"
          >
            {creatingNew ? `← ${t.addItem.pickExisting}` : `+ ${t.addItem.orCreateNew}`}
          </button>

          {creatingNew && (
            <div className="grid grid-cols-1 gap-4 rounded-xl bg-muted/40 p-3.5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t.addItem.newProductBrand}</label>
                <input
                  name="newProductBrandName"
                  type="text"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t.addItem.newProductName}</label>
                <input
                  name="newProductName"
                  type="text"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t.addItem.newProductCategory}</label>
                <select
                  name="newProductCategory"
                  defaultValue="OTHER"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
                >
                  {PRODUCT_CATEGORY_VALUES.map((v) => (
                    <option key={v} value={v}>
                      {t.category[v]}
                    </option>
                  ))}
                </select>
              </div>
              <Field label={t.products.subcategoryLabel} name="newProductSubcategory" />
              <Field label={t.products.barcodeLabel} name="newProductBarcode" />
              <Field label={t.products.countryOfOriginLabel} name="newProductCountryOfOrigin" />
              <Field label={t.products.manufacturerLabel} name="newProductManufacturer" />
              <Field label={t.products.packageSizeLabel} name="newProductPackageSize" />
            </div>
          )}
        </>
      ) : (
        item?.product && (
          <div className="rounded-xl bg-muted/40 p-3.5">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t.itemDetail.brandLabel}</p>
            <p className="text-sm font-medium">
              {item.product.brandName} · {item.product.productName}
            </p>
          </div>
        )
      )}

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
        <div className="flex flex-wrap items-center gap-2">
          <select
            name="photoType"
            defaultValue="PRODUCT"
            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring/50"
          >
            {PHOTO_TYPE_VALUES.map((v) => (
              <option key={v} value={v}>
                {t.photoType[v]}
              </option>
            ))}
          </select>
          <input
            type="file"
            name="photos"
            accept="image/*"
            capture="environment"
            multiple
            className="block text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-accent"
          />
        </div>
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
}: {
  label: string;
  name: string;
  defaultValue?: string;
  error?: string[];
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
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
