"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AssigneeField } from "@/components/assignee-field";
import { WorkColorField } from "@/components/work-color-field";
import type { WorkFormState } from "@/app/(dashboard)/work/actions";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";
import { toDateInputValue } from "@/lib/format-date";
import { compressImage } from "@/lib/compress-image";
import { MAX_UPLOAD_BYTES } from "@/lib/upload-limits";

type Props = {
  locale: Locale;
  action: (prevState: WorkFormState, formData: FormData) => Promise<WorkFormState>;
  mode?: "create" | "edit";
  defaultAssignee?: string;
  assigneeOptions?: string[];
  // Only an ADMIN session ever sees the "보안" checkbox at all -- a DEVELOPER/USER
  // can't set or clear it, and (since the detail/edit pages 404 a secure item for
  // them) never even reaches this form for one that's already flagged.
  canSetSecure?: boolean;
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
    isSecure?: boolean;
  };
};

const initialState: WorkFormState = {};

export function WorkForm({
  locale,
  action,
  mode = "create",
  defaultAssignee,
  assigneeOptions = [],
  canSetSecure = false,
  defaultValues,
}: Props) {
  const dict = getDictionary(locale);
  const t = dict.work.form;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const router = useRouter();
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [isPreparingFile, setIsPreparingFile] = React.useState(false);

  // Non-images can't be made smaller, so an oversized one is refused the moment it's picked.
  // Oversized images are allowed through here: they get shrunk on submit (below).
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0];
    setFileError(null);
    if (file && file.size > MAX_UPLOAD_BYTES && !file.type.startsWith("image/")) {
      setFileError(dict.common.fileTooLarge);
      e.currentTarget.value = "";
    }
  }

  // Submitted by hand (not <form action>) so a validation error doesn't wipe the form --
  // see lib/submit-without-reset.ts -- and so an oversized image attachment can be shrunk
  // first. Images under the limit are left exactly as picked (a screenshot of a document
  // should stay sharp); only ones over it are resized.
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    setFileError(null);
    const raw = formData.get("file");
    if (raw instanceof File && raw.size > MAX_UPLOAD_BYTES) {
      setIsPreparingFile(true);
      const file = await compressImage(raw, { maxDimension: 2400, quality: 0.85 });
      setIsPreparingFile(false);
      if (file.size > MAX_UPLOAD_BYTES) {
        setFileError(dict.common.fileTooLarge);
        return;
      }
      formData.set("file", file);
    }
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
      <Field
        label={t.categoryLabel}
        name="category"
        required
        defaultValue={defaultValues?.category ?? ""}
        error={state.errors?.category}
      />
      <WorkColorField label={t.colorLabel} noneLabel={t.noColor} defaultValue={defaultValues?.color} />

      {canSetSecure && (
        <label className="flex items-start gap-2 rounded-lg border border-border px-3 py-2.5 text-sm">
          <input
            type="checkbox"
            name="isSecure"
            value="true"
            defaultChecked={defaultValues?.isSecure ?? false}
            className="mt-0.5 size-4 rounded border-border"
          />
          <span>
            <span className="font-medium">{t.secureLabel}</span>
            <span className="block text-xs text-muted-foreground">{t.secureHint}</span>
          </span>
        </label>
      )}

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
          error={state.errors?.startDate}
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
          {t.fileLabel} <span className="text-xs font-normal text-muted-foreground">({dict.common.uploadLimitHint})</span>
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
          onChange={handleFileChange}
          className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-accent"
        />
        {fileError && <p className="text-xs text-destructive">{fileError}</p>}
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending || isPreparingFile}>
          {isPending || isPreparingFile ? t.creating : mode === "edit" ? t.saveChanges : t.createButton}
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
