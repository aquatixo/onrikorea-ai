"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { Brand, BrandStatus } from "@prisma/client";
import type { BrandFormState } from "@/app/brands/actions";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";

const STATUS_OPTIONS: BrandStatus[] = [
  "NEW",
  "SCREENING",
  "APPROVED",
  "CONTACTED",
  "REPLIED",
  "REJECTED",
  "ONBOARDED",
];

type Props = {
  mode: "create" | "update";
  brand?: Brand;
  locale: Locale;
  action: (prevState: BrandFormState, formData: FormData) => Promise<BrandFormState>;
};

const initialState: BrandFormState = {};

export function BrandForm({ mode, brand, locale, action }: Props) {
  const t = getDictionary(locale);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const router = useRouter();

  return (
    <form action={formAction} className="space-y-5">
      {state.message && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.message}
        </p>
      )}

      <Field
        label={t.form.name}
        name="name"
        required
        error={state.errors?.name}
        defaultValue={brand?.name}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t.form.methodology} name="methodology" defaultValue={brand?.methodology ?? ""} />
        <Field label={t.form.channel} name="channel" defaultValue={brand?.channel ?? ""} />
        <Field label={t.form.country} name="country" defaultValue={brand?.country ?? ""} />
        <Field label={t.form.sku} name="sku" defaultValue={brand?.sku ?? ""} />
        <Field
          label={t.form.foundedYear}
          name="foundedYear"
          type="number"
          error={state.errors?.foundedYear}
          defaultValue={brand?.foundedYear?.toString() ?? ""}
        />
        <Field label={t.form.website} name="website" defaultValue={brand?.website ?? ""} />
        <Field label={t.form.contactPoint} name="contactPoint" defaultValue={brand?.contactPoint ?? ""} />
        <div className="space-y-1.5">
          <label htmlFor="status" className="text-sm font-medium">
            {t.form.status}
          </label>
          <select
            id="status"
            name="status"
            defaultValue={brand?.status ?? "NEW"}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {t.status[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="coldEmail"
            defaultChecked={brand?.coldEmail}
            className="size-4 rounded border-border"
          />
          {t.form.coldEmailSent}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="reply"
            defaultChecked={brand?.reply}
            className="size-4 rounded border-border"
          />
          {t.form.replyReceived}
        </label>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="notes" className="text-sm font-medium">
          {t.form.notesLabel}
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={brand?.notes ?? ""}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? t.form.saving : mode === "create" ? t.form.createBrand : t.form.saveChanges}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          {t.form.cancel}
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
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue?: string;
  error?: string[];
  required?: boolean;
  type?: string;
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
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
      />
      {error && <p className="text-xs text-destructive">{error[0]}</p>}
    </div>
  );
}
