"use client";

import * as React from "react";
import { WorkCommentForm } from "@/components/work-comment-form";
import { UserAvatar } from "@/components/user-avatar";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";
import type { WorkComment } from "@prisma/client";

type CommentWithReplies = WorkComment & { replies: WorkComment[] };

function formatTimestamp(date: Date, locale: Locale) {
  return date.toLocaleString(locale === "ko" ? "ko-KR" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function WorkCommentItem({
  comment,
  workItemId,
  authorName,
  locale,
}: {
  comment: CommentWithReplies;
  workItemId: string;
  authorName: string;
  locale: Locale;
}) {
  const t = getDictionary(locale).work.detail;
  const [isReplying, setIsReplying] = React.useState(false);

  return (
    <div className="flex gap-3">
      <UserAvatar name={comment.authorName} />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="rounded-2xl rounded-tl-sm bg-muted/60 px-3.5 py-2.5">
          <div className="mb-0.5 flex items-baseline gap-2">
            <span className="text-sm font-semibold">{comment.authorName}</span>
            <span className="text-[11px] text-muted-foreground">{formatTimestamp(comment.createdAt, locale)}</span>
          </div>
          <p className="text-sm whitespace-pre-wrap text-foreground/90">{comment.body}</p>
        </div>

        <button
          onClick={() => setIsReplying((v) => !v)}
          className="ml-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
        >
          {t.reply}
        </button>

        {comment.replies.length > 0 && (
          <div className="space-y-2.5 border-l-2 border-border/70 pl-3">
            {comment.replies.map((reply) => (
              <div key={reply.id} className="flex gap-2.5">
                <UserAvatar name={reply.authorName} size="sm" />
                <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm bg-muted/40 px-3 py-2">
                  <div className="mb-0.5 flex items-baseline gap-2">
                    <span className="text-xs font-semibold">{reply.authorName}</span>
                    <span className="text-[10px] text-muted-foreground">{formatTimestamp(reply.createdAt, locale)}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap text-foreground/90">{reply.body}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {isReplying && (
          <div className="pt-1">
            <WorkCommentForm
              workItemId={workItemId}
              parentId={comment.id}
              authorName={authorName}
              locale={locale}
              onPosted={() => setIsReplying(false)}
              compact
            />
          </div>
        )}
      </div>
    </div>
  );
}
