import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { getUserName } from "@/lib/user/get-user-name";
import { WorkStatusControl } from "@/components/work-status-control";
import { WorkCommentForm } from "@/components/work-comment-form";
import { WorkCommentItem } from "@/components/work-comment-item";

export const dynamic = "force-dynamic";

export default async function WorkDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const locale = await getLocale();
  const t = getDictionary(locale);
  const authorName = await getUserName();

  const item = await db.workItem.findUnique({
    where: { id },
    include: {
      comments: {
        where: { parentId: null },
        orderBy: { createdAt: "asc" },
        include: { replies: { orderBy: { createdAt: "asc" } } },
      },
    },
  });

  if (!item) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-6 py-10 sm:px-8 sm:py-12">
      <Link href="/work" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {t.work.detail.back}
      </Link>

      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">{item.title}</h1>
            <p className="text-sm text-muted-foreground">{item.assigneeName}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{t.work.detail.status}</p>
            <WorkStatusControl workItemId={item.id} status={item.status} locale={locale} />
          </div>
        </div>

        <div className="rounded-xl border border-border p-4">
          <p className="mb-1 text-xs font-medium text-muted-foreground">{t.work.detail.content}</p>
          <p className="text-sm whitespace-pre-wrap">{item.content || t.work.detail.noContent}</p>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-semibold">{t.work.detail.comments}</h2>

        {item.comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.work.detail.noComments}</p>
        ) : (
          <div className="space-y-3">
            {item.comments.map((comment) => (
              <WorkCommentItem
                key={comment.id}
                comment={comment}
                workItemId={item.id}
                authorName={authorName}
                locale={locale}
              />
            ))}
          </div>
        )}

        <WorkCommentForm workItemId={item.id} authorName={authorName} locale={locale} />
      </div>
    </main>
  );
}
