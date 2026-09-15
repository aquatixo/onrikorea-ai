"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AssigneeField } from "@/components/assignee-field";
import type { WorkFormState } from "@/app/work/actions";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";

type Props = {
  locale: Locale;
  action: (prevState: WorkFormState, formData: FormData) => Promise<WorkFormState>;
  defaultAssignee?: string;
  assigneeOptions: string[];
};

const initialState: WorkFormState = {};

export function WorkForm({ locale, action, defaultAssignee, assigneeOptions }: Props) {
  const t = getDictionary(locale).work.form;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const router = useRouter();

  return (
    <form action={formAction} className="space-y-5">
      {state.message && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.message}
        </p>
      )}

      <Field label={t.titleLabel} name="title" required error={state.errors?.title} />
      <AssigneeField
        label={t.assigneeLabel}
        options={assigneeOptions}
        defaultValue={defaultAssignee}
        error={state.errors?.assigneeName}
        addNewLabel={t.addNewAssignee}
        backLabel={t.backToList}
      />

      <div className="space-y-1.5">
        <label htmlFor="content" className="text-sm font-medium">
          {t.contentLabel}
        </label>
        <textarea
          id="content"
          name="content"
          rows={5}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
        />
        {state.errors?.content && <p className="text-xs text-destructive">{state.errors.content[0]}</p>}
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? t.creating : t.createButton}
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
