import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Paperclip } from "lucide-react";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { getUserName } from "@/lib/user/get-user-name";
import { Button } from "@/components/ui/button";
import { WorkStatusControl } from "@/components/work-status-control";
import { WorkCommentForm } from "@/components/work-comment-form";
import { WorkCommentItem } from "@/components/work-comment-item";

export const dynamic = "force-dynamic";

function formatDate(d: Date | null, locale: string) {
  return d ? d.toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US") : null;
}

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

  const dateRange = [formatDate(item.startDate, locale), formatDate(item.endDate, locale)]
    .filter(Boolean)
    .join(" — ");

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-6 py-10 sm:px-8 sm:py-12">
      <div className="flex items-center justify-between">
        <Link href="/work" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> {t.work.detail.back}
        </Link>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={
            <Link href={`/work/${item.id}/edit`}>
              <Pencil className="size-4" /> {t.work.detail.edit}
            </Link>
          }
        />
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            {item.color && (
              <span
                className="mt-1.5 size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
                aria-hidden
              />
            )}
            <div>
              <h1 className="text-xl font-bold tracking-tight">{item.title}</h1>
              <p className="text-sm text-muted-foreground">
                {item.assigneeName}
                {item.category ? ` · ${item.category}` : ""}
              </p>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{t.work.detail.status}</p>
            <WorkStatusControl workItemId={item.id} status={item.status} locale={locale} />
          </div>
        </div>

        {dateRange && (
          <p className="text-xs text-muted-foreground">
            {t.work.detail.timeline}: {dateRange}
          </p>
        )}

        <div className="rounded-xl border border-border p-4">
          <p className="mb-1 text-xs font-medium text-muted-foreground">{t.work.detail.content}</p>
          <p className="text-sm whitespace-pre-wrap">{item.content || t.work.detail.noContent}</p>
        </div>

        {item.fileUrl && (
          <a
            href={item.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <Paperclip className="size-4" /> {item.fileName}
          </a>
        )}
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
