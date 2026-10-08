"use client";

import * as React from "react";
import { useActionState } from "react";
import { submitWithoutReset } from "@/lib/submit-without-reset";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PAGE_SECTIONS, type PageSection } from "@/lib/access-control";
import type { UserFormState } from "@/app/(dashboard)/settings/users/actions";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";

const initialState: UserFormState = {};

type ExistingUser = {
  id: string;
  username: string;
  name: string;
  role: "ADMIN" | "DEVELOPER" | "USER";
  allowedPages: string[];
};

export function UserForm({
  user,
  locale,
  action,
}: {
  user?: ExistingUser;
  locale: Locale;
  action: (prevState: UserFormState, formData: FormData) => Promise<UserFormState>;
}) {
  const t = getDictionary(locale);
  const nav = t.nav;
  const tu = t.settings.users;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const router = useRouter();
  const [role, setRole] = React.useState<"ADMIN" | "DEVELOPER" | "USER">(user?.role ?? "USER");
  const [allowedPages, setAllowedPages] = React.useState<Set<string>>(new Set(user?.allowedPages ?? []));
  const [resetPassword, setResetPassword] = React.useState(false);

  const SECTION_LABEL: Record<PageSection, string> = {
    brands: nav.brands,
    brandSourcing: nav.brandSourcing,
    work: nav.work,
    stores: nav.stores,
    storeVisits: nav.storeVisits,
    products: nav.products,
  };

  return (
    <form onSubmit={submitWithoutReset(formAction)} className="space-y-5">
      {state.message && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.message}
        </p>
      )}

      {!user && (
        <Field
          label={tu.usernameLabel}
          name="username"
          required
          hint={tu.usernameHint}
          error={state.errors?.username}
        />
      )}
      <Field label={tu.nameLabel} name="name" required defaultValue={user?.name} error={state.errors?.name} />

      {user ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="resetPassword"
            checked={resetPassword}
            onChange={(e) => setResetPassword(e.target.checked)}
          />
          {tu.resetPasswordLabel}
        </label>
      ) : (
        <p className="text-xs text-muted-foreground">{tu.newUserPasswordNote}</p>
      )}

      {user && <p className="text-xs text-muted-foreground">{tu.editTakesEffectNote}</p>}

      <div className="space-y-1.5">
        <label htmlFor="role" className="text-sm font-medium">
          {tu.roleLabel}
        </label>
        <select
          id="role"
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value as "ADMIN" | "DEVELOPER" | "USER")}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
        >
          <option value="USER">{tu.roleUser}</option>
          <option value="DEVELOPER">{tu.roleDeveloper}</option>
          <option value="ADMIN">{tu.roleAdmin}</option>
        </select>
      </div>

      {role === "ADMIN" || role === "DEVELOPER" ? (
        <p className="text-xs text-muted-foreground">
          {role === "ADMIN" ? tu.adminFullAccessNote : tu.developerFullAccessNote}
        </p>
      ) : (
        <div className="space-y-1.5">
          <label className="text-sm font-medium">{tu.pagesLabel}</label>
          <div className="grid grid-cols-2 gap-2">
            {PAGE_SECTIONS.map((section) => (
              <label key={section} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  name="allowedPages"
                  value={section}
                  checked={allowedPages.has(section)}
                  onChange={(e) => {
                    setAllowedPages((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(section);
                      else next.delete(section);
                      return next;
                    });
                  }}
                />
                {SECTION_LABEL[section]}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? t.settings.saving : user ? tu.saveButton : tu.createButton}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          {t.settings.back}
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
  hint,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  error?: string[];
  hint?: string;
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
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
      />
      {error ? <p className="text-xs text-destructive">{error[0]}</p> : hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
