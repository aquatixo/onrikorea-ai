"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AssigneeField } from "@/components/assignee-field";
import { WorkColorField } from "@/components/work-color-field";
import type { WorkFormState } from "@/app/work/actions";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";

type Props = {
  locale: Locale;
  action: (prevState: WorkFormState, formData: FormData) => Promise<WorkFormState>;
  mode?: "create" | "edit";
  defaultAssignee?: string;
  assigneeOptions?: string[];
  defaultValues?: {
    title?: string;
    assigneeName?: string | null;
    content?: string | null;
    category?: string | null;
    color?: string | null;
    startDate?: Date | null;
    endDate?: Date | null;
    fileUrl?: string | null;
    fileName?: string | null;
  };
};

const initialState: WorkFormState = {};

function toDateInputValue(d?: Date | null): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

export function WorkForm({
  locale,
  action,
  mode = "create",
  defaultAssignee,
  assigneeOptions = [],
  defaultValues,
}: Props) {
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

      <Field
        label={t.titleLabel}
        name="title"
        required
        error={state.errors?.title}
        defaultValue={defaultValues?.title}
      />

      <AssigneeField
        label={t.assigneeLabel}
        options={assigneeOptions}
        defaultValue={defaultAssignee ?? defaultValues?.assigneeName ?? undefined}
        error={state.errors?.assigneeName}
        chooseLabel={t.choosePlaceholder}
      />
      <Field label={t.categoryLabel} name="category" defaultValue={defaultValues?.category ?? ""} />
      <WorkColorField label={t.colorLabel} noneLabel={t.noColor} defaultValue={defaultValues?.color} />

      <div className="space-y-1.5">
        <label htmlFor="content" className="text-sm font-medium">
          {t.contentLabel}
        </label>
        <textarea
          id="content"
          name="content"
          rows={5}
          defaultValue={defaultValues?.content ?? ""}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
        />
        {state.errors?.content && <p className="text-xs text-destructive">{state.errors.content[0]}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label={t.startDateLabel}
          name="startDate"
          type="date"
          defaultValue={toDateInputValue(defaultValues?.startDate)}
        />
        <Field
          label={t.endDateLabel}
          name="endDate"
          type="date"
          error={state.errors?.endDate}
          defaultValue={toDateInputValue(defaultValues?.endDate)}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="file" className="text-sm font-medium">
          {t.fileLabel}
        </label>
        {defaultValues?.fileUrl && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
            <a href={defaultValues.fileUrl} target="_blank" rel="noopener noreferrer" className="truncate text-primary hover:underline">
              {defaultValues.fileName}
            </a>
            <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
              <input type="checkbox" name="removeFile" value="true" className="size-3.5 rounded border-border" />
              {t.removeFile}
            </label>
          </div>
        )}
        <input
          id="file"
          name="file"
          type="file"
          className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-accent"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? t.creating : mode === "edit" ? t.saveChanges : t.createButton}
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
