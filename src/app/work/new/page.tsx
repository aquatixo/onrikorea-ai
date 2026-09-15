import { db } from "@/lib/db";
import { WorkForm } from "@/components/work-form";
import { createWork } from "@/app/work/actions";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

export default async function NewWorkPage(props: { searchParams: Promise<{ assignee?: string }> }) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const { assignee } = await props.searchParams;

  const assignees = await db.workItem.findMany({
    distinct: ["assigneeName"],
    select: { assigneeName: true },
    orderBy: { assigneeName: "asc" },
  });

  return (
    <main className="mx-auto w-full max-w-xl space-y-6 px-6 py-10 sm:px-8 sm:py-12">
      <h1 className="text-2xl font-bold tracking-tight">{t.work.form.addTitle}</h1>
      <WorkForm
        locale={locale}
        action={createWork}
        defaultAssignee={assignee}
        assigneeOptions={assignees.map((a) => a.assigneeName)}
      />
    </main>
  );
}
