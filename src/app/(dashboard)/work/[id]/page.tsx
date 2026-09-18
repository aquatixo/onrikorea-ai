import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Paperclip, CalendarRange, MessageSquare } from "lucide-react";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { getUserName } from "@/lib/user/get-user-name";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { WorkStatusControl } from "@/components/work-status-control";
import { WorkCommentForm } from "@/components/work-comment-form";
import { WorkCommentItem } from "@/components/work-comment-item";
import { DeleteWorkButton } from "@/components/work/delete-work-button";

export const dynamic = "force-dynamic";

function formatDate(d: Date | null, locale: string) {
  return d
    ? d.toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", { year: "numeric", month: "short", day: "numeric" })
    : null;
}

export default async function WorkDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { id } = await props.params;
  const { returnTo } = await props.searchParams;
  // Only ever navigate back within /work -- never follow an arbitrary URL from the query string.
  const backHref = returnTo && returnTo.startsWith("/work") ? returnTo : "/work";
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

  const totalComments = item.comments.reduce((n, c) => n + 1 + c.replies.length, 0);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-5 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex items-center justify-between">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> {t.work.detail.back}
        </Link>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={
              <Link href={`/work/${item.id}/edit?returnTo=${encodeURIComponent(backHref)}`}>
                <Pencil className="size-4" /> {t.work.detail.edit}
              </Link>
            }
          />
          <DeleteWorkButton workItemId={item.id} returnTo={backHref} locale={locale} />
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="h-1.5 w-full" style={{ backgroundColor: item.color || "var(--border)" }} aria-hidden />
        <div className="space-y-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2.5">
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{item.title}</h1>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted py-1 pr-2.5 pl-1 text-xs font-medium text-muted-foreground">
                  <UserAvatar name={item.assigneeName} size="sm" />
                  {item.assigneeName}
                </span>
                {item.category && (
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    {item.category}
                  </span>
                )}
                {dateRange && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    <CalendarRange className="size-3" /> {dateRange}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <p className="text-[11px] font-medium text-muted-foreground">{t.work.detail.status}</p>
              <WorkStatusControl workItemId={item.id} status={item.status} locale={locale} />
            </div>
          </div>

          <div className="rounded-xl bg-muted/40 p-4">
            <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t.work.detail.content}
            </p>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{item.content || t.work.detail.noContent}</p>
          </div>

          {item.fileUrl && (
            <a
              href={item.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-primary transition hover:bg-muted"
            >
              <Paperclip className="size-4" /> {item.fileName}
            </a>
          )}
        </div>
      </section>

      <section className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <MessageSquare className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">{t.work.detail.comments}</h2>
          {totalComments > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {totalComments}
            </span>
          )}
        </div>

        {item.comments.length === 0 ? (
          <p className="py-1 text-sm text-muted-foreground">{t.work.detail.noComments}</p>
        ) : (
          <div className="space-y-5">
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

        <div className="border-t border-border pt-4">
          <WorkCommentForm workItemId={item.id} authorName={authorName} locale={locale} />
        </div>
      </section>
    </main>
  );
}
