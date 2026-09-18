"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PRODUCT_CATEGORY_VALUES } from "@/lib/field-status";
import type { ProductFormState } from "@/app/field/products/actions";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";
import type { Product } from "@prisma/client";

const initialState: ProductFormState = {};

export function ProductForm({
  mode,
  product,
  locale,
  action,
}: {
  mode: "create" | "update";
  product?: Product;
  locale: Locale;
  action: (prevState: ProductFormState, formData: FormData) => Promise<ProductFormState>;
}) {
  const t = getDictionary(locale).field;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const router = useRouter();

  return (
    <form action={formAction} className="space-y-5">
      {state.message && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.message}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label={t.products.brandNameLabel}
          name="brandName"
          required
          defaultValue={product?.brandName}
          error={state.errors?.brandName}
        />
        <Field
          label={t.products.productNameLabel}
          name="productName"
          required
          defaultValue={product?.productName}
          error={state.errors?.productName}
        />
        <div className="space-y-1.5">
          <label htmlFor="category" className="text-sm font-medium">
            {t.products.categoryLabel}
          </label>
          <select
            id="category"
            name="category"
            defaultValue={product?.category ?? "OTHER"}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
          >
            {PRODUCT_CATEGORY_VALUES.map((v) => (
              <option key={v} value={v}>
                {t.category[v]}
              </option>
            ))}
          </select>
        </div>
        <Field label={t.products.subcategoryLabel} name="subcategory" defaultValue={product?.subcategory ?? ""} />
        <Field label={t.products.barcodeLabel} name="barcode" defaultValue={product?.barcode ?? ""} />
        <Field
          label={t.products.countryOfOriginLabel}
          name="countryOfOrigin"
          defaultValue={product?.countryOfOrigin ?? ""}
        />
        <Field label={t.products.manufacturerLabel} name="manufacturer" defaultValue={product?.manufacturer ?? ""} />
        <Field label={t.products.packageSizeLabel} name="packageSize" defaultValue={product?.packageSize ?? ""} />
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? t.saving : mode === "create" ? t.products.createButton : t.saveChanges}
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
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  error?: string[];
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
        type="text"
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
      />
      {error && <p className="text-xs text-destructive">{error[0]}</p>}
    </div>
  );
}
