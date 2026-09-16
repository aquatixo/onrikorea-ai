import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { WorkForm } from "@/components/work-form";
import { updateWork } from "@/app/work/actions";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

export default async function EditWorkPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const locale = await getLocale();
  const t = getDictionary(locale);

  const [item, people] = await Promise.all([
    db.workItem.findUnique({ where: { id } }),
    db.person.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!item) notFound();

  return (
    <main className="mx-auto w-full max-w-xl space-y-5 px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href={`/work/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {t.work.form.back}
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">{t.work.form.editTitle}</h1>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <WorkForm
          locale={locale}
          action={updateWork.bind(null, id)}
          mode="edit"
          assigneeOptions={people.map((p) => p.name)}
          defaultValues={{
            title: item.title,
            assigneeName: item.assigneeName,
            category: item.category,
            color: item.color,
            content: item.content,
            startDate: item.startDate,
            endDate: item.endDate,
            fileUrl: item.fileUrl,
            fileName: item.fileName,
          }}
        />
      </div>
    </main>
  );
}
