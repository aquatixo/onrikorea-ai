import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { UserForm } from "@/components/settings/user-form";
import { updateUser } from "@/app/(dashboard)/settings/users/actions";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

export const dynamic = "force-dynamic";

export default async function EditUserPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const locale = await getLocale();
  const t = getDictionary(locale).settings;
  // Scoped select -- this row gets passed straight into a client component, so
  // passwordHash (and anything else not listed here) must never be fetched at all.
  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, username: true, name: true, role: true, allowedPages: true },
  });
  if (!user) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl space-y-5 px-4 py-8 sm:px-6 sm:py-10">
      <Link href="/settings/users" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {t.back}
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">{t.users.editUser}</h1>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <UserForm user={user} locale={locale} action={updateUser.bind(null, id)} />
      </div>
    </main>
  );
}
