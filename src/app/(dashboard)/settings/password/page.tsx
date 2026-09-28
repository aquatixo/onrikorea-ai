import Link from "next/link";
import { ArrowLeft, KeyRound } from "lucide-react";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const locale = await getLocale();
  const t = getDictionary(locale).settings;

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-6 py-10 sm:px-8 sm:py-12">
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {t.back}
      </Link>
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
          <KeyRound className="size-5 text-primary" />
        </span>
        <h1 className="text-2xl font-bold tracking-tight">{t.changePasswordHeading}</h1>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <ChangePasswordForm locale={locale} />
      </div>
    </main>
  );
}
