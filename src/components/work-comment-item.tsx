"use client";

import * as React from "react";
import { WorkCommentForm } from "@/components/work-comment-form";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";
import type { WorkComment } from "@prisma/client";

type CommentWithReplies = WorkComment & { replies: WorkComment[] };

function formatTimestamp(date: Date, locale: Locale) {
  return date.toLocaleString(locale === "ko" ? "ko-KR" : "en-US");
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
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">{comment.authorName}</span>
          <span className="text-xs text-muted-foreground">{formatTimestamp(comment.createdAt, locale)}</span>
        </div>
        <p className="text-sm whitespace-pre-wrap">{comment.body}</p>
      </div>

      {comment.replies.length > 0 && (
        <div className="ml-4 space-y-2 border-l border-border pl-3">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{reply.authorName}</span>
                <span className="text-xs text-muted-foreground">{formatTimestamp(reply.createdAt, locale)}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{reply.body}</p>
            </div>
          ))}
        </div>
      )}

      {isReplying ? (
        <div className="ml-4">
          <WorkCommentForm
            workItemId={workItemId}
            parentId={comment.id}
            authorName={authorName}
            locale={locale}
            onPosted={() => setIsReplying(false)}
          />
        </div>
      ) : (
        <button
          onClick={() => setIsReplying(true)}
          className="ml-4 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {t.reply}
        </button>
      )}
    </div>
  );
}
