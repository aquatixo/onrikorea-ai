"use client";

import { useActionState } from "react";
import { User, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loginAction, type LoginState } from "@/app/login/actions";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";

export function LoginForm({ locale, callbackUrl }: { locale: Locale; callbackUrl: string }) {
  const t = getDictionary(locale).login;
  const boundAction = loginAction.bind(null, callbackUrl);
  const [state, formAction, isPending] = useActionState<LoginState, FormData>(boundAction, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="username" className="text-sm font-medium">
          {t.usernameLabel}
        </label>
        <div className="relative">
          <User className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            required
            placeholder={t.usernamePlaceholder}
            className="w-full rounded-lg border border-border bg-background py-2 pr-3 pl-9 text-sm outline-none focus:ring-2 focus:ring-ring/50"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          {t.passwordLabel}
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder={t.passwordPlaceholder}
            className="w-full rounded-lg border border-border bg-background py-2 pr-3 pl-9 text-sm outline-none focus:ring-2 focus:ring-ring/50"
          />
        </div>
      </div>

      {state?.error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <Button type="submit" size="lg" disabled={isPending} className="w-full justify-center">
        {isPending ? t.signingIn : t.signIn}
        {!isPending && <ArrowRight className="size-4" />}
      </Button>
    </form>
  );
}
