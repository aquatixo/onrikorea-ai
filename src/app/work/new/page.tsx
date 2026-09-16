import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { WorkForm } from "@/components/work-form";
import { createWork } from "@/app/work/actions";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

export default async function NewWorkPage(props: { searchParams: Promise<{ assignee?: string }> }) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const { assignee } = await props.searchParams;

  const people = await db.person.findMany({ orderBy: { name: "asc" } });
  const backHref = assignee ? `/work?assignee=${encodeURIComponent(assignee)}` : "/work";

  return (
    <main className="mx-auto w-full max-w-xl space-y-5 px-4 py-8 sm:px-6 sm:py-10">
      <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {t.work.form.back}
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">{t.work.form.addTitle}</h1>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <WorkForm
          locale={locale}
          action={createWork}
          defaultAssignee={assignee}
          assigneeOptions={people.map((p) => p.name)}
        />
      </div>
    </main>
  );
}
