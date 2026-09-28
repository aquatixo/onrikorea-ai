"use client";

import { useActionState, useEffect, useRef } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { changePassword, type ChangePasswordState } from "@/app/(dashboard)/settings/actions";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";

const initialState: ChangePasswordState = {};

export function ChangePasswordForm({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).settings;
  const [state, formAction, isPending] = useActionState(changePassword, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {state.message && (
        <p
          className={`rounded-lg border px-3 py-2 text-sm ${
            state.success
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
        >
          {state.message}
        </p>
      )}

      <PasswordField
        name="currentPassword"
        label={t.currentPasswordLabel}
        autoComplete="current-password"
        error={state.errors?.currentPassword}
      />
      <PasswordField
        name="newPassword"
        label={t.newPasswordLabel}
        autoComplete="new-password"
        hint={t.newPasswordHint}
        error={state.errors?.newPassword}
      />
      <PasswordField
        name="confirmPassword"
        label={t.confirmPasswordLabel}
        autoComplete="new-password"
        error={state.errors?.confirmPassword}
      />

      <Button type="submit" disabled={isPending}>
        {isPending ? t.saving : t.saveButton}
      </Button>
    </form>
  );
}

function PasswordField({
  name,
  label,
  autoComplete,
  hint,
  error,
}: {
  name: string;
  label: string;
  autoComplete: string;
  hint?: string;
  error?: string[];
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id={name}
          name={name}
          type="password"
          autoComplete={autoComplete}
          required
          className="w-full rounded-lg border border-border bg-background py-2 pr-3 pl-9 text-sm outline-none focus:ring-2 focus:ring-ring/50"
        />
      </div>
      {error ? (
        <p className="text-xs text-destructive">{error[0]}</p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
