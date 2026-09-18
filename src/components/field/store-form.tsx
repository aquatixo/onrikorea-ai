"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { STORE_TYPE_VALUES } from "@/lib/field-status";
import type { StoreFormState } from "@/app/field/stores/actions";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";
import type { Store } from "@prisma/client";

const initialState: StoreFormState = {};

export function StoreForm({
  mode,
  store,
  locale,
  action,
}: {
  mode: "create" | "update";
  store?: Store;
  locale: Locale;
  action: (prevState: StoreFormState, formData: FormData) => Promise<StoreFormState>;
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

      <Field label={t.stores.nameLabel} name="name" required defaultValue={store?.name} error={state.errors?.name} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t.stores.chainLabel} name="chain" defaultValue={store?.chain ?? ""} />
        <div className="space-y-1.5">
          <label htmlFor="storeType" className="text-sm font-medium">
            {t.stores.typeLabel}
          </label>
          <select
            id="storeType"
            name="storeType"
            defaultValue={store?.storeType ?? "OTHER"}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
          >
            {STORE_TYPE_VALUES.map((v) => (
              <option key={v} value={v}>
                {t.storeType[v]}
              </option>
            ))}
          </select>
        </div>
        <Field label={t.stores.addressLabel} name="address" defaultValue={store?.address ?? ""} />
        <Field label={t.stores.cityLabel} name="city" defaultValue={store?.city ?? ""} />
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? t.saving : mode === "create" ? t.stores.createButton : t.saveChanges}
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
