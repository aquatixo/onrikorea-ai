import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { UserForm } from "@/components/settings/user-form";
import { createUser } from "@/app/(dashboard)/settings/users/actions";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

export const dynamic = "force-dynamic";

export default async function NewUserPage() {
  const locale = await getLocale();
  const t = getDictionary(locale).settings;

  return (
    <main className="mx-auto w-full max-w-2xl space-y-5 px-4 py-8 sm:px-6 sm:py-10">
      <Link href="/settings/users" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {t.back}
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">{t.users.addUser}</h1>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <UserForm locale={locale} action={createUser} />
      </div>
    </main>
  );
}
