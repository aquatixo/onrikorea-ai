import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { WorkForm } from "@/components/work-form";
import { updateWork } from "@/app/work/actions";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

export default async function EditWorkPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const locale = await getLocale();
  const t = getDictionary(locale);

  const [item, assignees] = await Promise.all([
    db.workItem.findUnique({ where: { id } }),
    db.workItem.findMany({
      distinct: ["assigneeName"],
      select: { assigneeName: true },
      orderBy: { assigneeName: "asc" },
    }),
  ]);
  if (!item) notFound();

  return (
    <main className="mx-auto w-full max-w-xl space-y-6 px-6 py-10 sm:px-8 sm:py-12">
      <h1 className="text-2xl font-bold tracking-tight">{t.work.form.editTitle}</h1>
      <WorkForm
        locale={locale}
        action={updateWork.bind(null, id)}
        mode="edit"
        assigneeOptions={assignees.map((a) => a.assigneeName)}
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
    </main>
  );
}
