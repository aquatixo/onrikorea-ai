"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { StoreVisitFormState } from "@/app/(dashboard)/field/store-visits/actions";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";
import type { Store, StoreVisit } from "@prisma/client";

const initialState: StoreVisitFormState = {};

function toDateInputValue(d?: Date): string {
  if (!d) return new Date().toISOString().slice(0, 10);
  return new Date(d).toISOString().slice(0, 10);
}

export function StoreVisitForm({
  mode,
  visit,
  stores,
  locale,
  action,
}: {
  mode: "create" | "update";
  visit?: StoreVisit;
  stores: Store[];
  locale: Locale;
  action: (prevState: StoreVisitFormState, formData: FormData) => Promise<StoreVisitFormState>;
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

      <div className="space-y-1.5">
        <label htmlFor="storeId" className="text-sm font-medium">
          {t.visits.storeLabel}
          <span className="text-destructive"> *</span>
        </label>
        <select
          id="storeId"
          name="storeId"
          required
          defaultValue={visit?.storeId ?? ""}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
        >
          <option value="" disabled>
            {t.choosePlaceholder}
          </option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.chain ? ` (${s.chain})` : ""}
            </option>
          ))}
        </select>
        {state.errors?.storeId && <p className="text-xs text-destructive">{state.errors.storeId[0]}</p>}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="visitDate" className="text-sm font-medium">
          {t.visits.visitDateLabel}
          <span className="text-destructive"> *</span>
        </label>
        <input
          id="visitDate"
          name="visitDate"
          type="date"
          required
          defaultValue={toDateInputValue(visit?.visitDate)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
        />
        {state.errors?.visitDate && <p className="text-xs text-destructive">{state.errors.visitDate[0]}</p>}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="visitor" className="text-sm font-medium">
          {t.visits.visitorLabel}
          <span className="text-destructive"> *</span>
        </label>
        <input
          id="visitor"
          name="visitor"
          type="text"
          required
          defaultValue={visit?.visitor}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
        />
        {state.errors?.visitor && <p className="text-xs text-destructive">{state.errors.visitor[0]}</p>}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="memo" className="text-sm font-medium">
          {t.visits.memoLabel}
        </label>
        <textarea
          id="memo"
          name="memo"
          rows={3}
          defaultValue={visit?.memo ?? ""}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? t.saving : mode === "create" ? t.visits.startVisit : t.saveChanges}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          {t.cancel}
        </Button>
      </div>
    </form>
  );
}
