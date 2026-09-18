"use client";

import * as React from "react";
import { Mail, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";

export function LoginForm({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).login;
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showPreviewNotice, setShowPreviewNotice] = React.useState(false);

  // Design preview only -- there's no auth wired up yet, so submitting just surfaces
  // that instead of silently doing nothing or pretending to sign the user in.
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setShowPreviewNotice(false);
    setTimeout(() => {
      setIsSubmitting(false);
      setShowPreviewNotice(true);
    }, 500);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          {t.emailLabel}
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder={t.emailPlaceholder}
            className="w-full rounded-lg border border-border bg-background py-2 pr-3 pl-9 text-sm outline-none focus:ring-2 focus:ring-ring/50"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="text-sm font-medium">
            {t.passwordLabel}
          </label>
          <button type="button" className="text-xs font-medium text-muted-foreground hover:text-foreground">
            {t.forgotPassword}
          </button>
        </div>
        <div className="relative">
          <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder={t.passwordPlaceholder}
            className="w-full rounded-lg border border-border bg-background py-2 pr-3 pl-9 text-sm outline-none focus:ring-2 focus:ring-ring/50"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" className="size-3.5 rounded border-border" />
        {t.rememberMe}
      </label>

      {showPreviewNotice && (
        <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          {t.notWiredUp}
        </p>
      )}

      <Button type="submit" size="lg" disabled={isSubmitting} className="w-full justify-center">
        {isSubmitting ? t.signingIn : t.signIn}
        {!isSubmitting && <ArrowRight className="size-4" />}
      </Button>
    </form>
  );
}
