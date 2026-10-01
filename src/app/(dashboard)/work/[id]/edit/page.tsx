import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { isOwnerOrAdmin } from "@/lib/auth/ownership";
import { WorkForm } from "@/components/work-form";
import { updateWork } from "@/app/(dashboard)/work/actions";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

export default async function EditWorkPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { id } = await props.params;
  const { returnTo } = await props.searchParams;
  // Only ever navigate back within /work -- never follow an arbitrary URL from the query string.
  const safeReturnTo = returnTo && returnTo.startsWith("/work") ? returnTo : undefined;
  const detailHref = safeReturnTo ? `/work/${id}?returnTo=${encodeURIComponent(safeReturnTo)}` : `/work/${id}`;
  const locale = await getLocale();
  const t = getDictionary(locale);

  const [item, session] = await Promise.all([db.workItem.findUnique({ where: { id } }), auth()]);
  if (!item) notFound();
  // Same as the detail page -- a secure item doesn't exist for anyone but ADMIN.
  if (item.isSecure && session?.user?.role !== "ADMIN") notFound();
  if (!isOwnerOrAdmin(session?.user, item.createdById)) redirect(detailHref);

  // Fetched only once we know the page will actually render the form.
  const people = await db.person.findMany({ orderBy: { name: "asc" } });

  return (
    <main className="mx-auto w-full max-w-xl space-y-5 px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href={detailHref}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {t.work.form.back}
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">{t.work.form.editTitle}</h1>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <WorkForm
          locale={locale}
          action={updateWork.bind(null, id, safeReturnTo)}
          mode="edit"
          assigneeOptions={people.map((p) => p.name)}
          canSetSecure={session?.user?.role === "ADMIN"}
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
            isSecure: item.isSecure,
          }}
        />
      </div>
    </main>
  );
}
