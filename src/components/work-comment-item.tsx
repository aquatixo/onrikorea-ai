"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { WorkCommentForm } from "@/components/work-comment-form";
import { UserAvatar } from "@/components/user-avatar";
import { updateWorkComment, deleteWorkComment } from "@/app/(dashboard)/work/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { isOwnerOrAdmin } from "@/lib/auth/ownership";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";
import type { WorkComment } from "@prisma/client";
import { formatShortDateTime } from "@/lib/format-date";

type CommentWithReplies = WorkComment & { replies: WorkComment[] };
type CurrentUser = { id: string; role: "ADMIN" | "DEVELOPER" | "USER" } | null;

function CommentActions({
  workItemId,
  comment,
  locale,
  onEdit,
}: {
  workItemId: string;
  comment: WorkComment;
  locale: Locale;
  onEdit: () => void;
}) {
  const t = getDictionary(locale).work.detail;
  const router = useRouter();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [isPending, startTransition] = useTransition();

  return (
    <>
      {confirmDialog}
      <button
        onClick={onEdit}
        className="text-xs font-medium text-muted-foreground transition hover:text-foreground"
      >
        {t.edit}
      </button>
      <button
        disabled={isPending}
        onClick={async () => {
          if (!(await confirm({ description: t.confirmDeleteComment, destructive: true }))) return;
          startTransition(async () => {
            const result = await deleteWorkComment(comment.id, workItemId);
            if (result?.error) await confirm({ description: result.error, alertOnly: true });
            router.refresh();
          });
        }}
        className="text-xs font-medium text-muted-foreground transition hover:text-destructive"
      >
        {t.delete}
      </button>
    </>
  );
}

function EditCommentForm({
  workItemId,
  comment,
  locale,
  onDone,
}: {
  workItemId: string;
  comment: WorkComment;
  locale: Locale;
  onDone: () => void;
}) {
  const t = getDictionary(locale).work.detail;
  const router = useRouter();
  const [body, setBody] = React.useState(comment.body);
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        className="w-full resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          onClick={onDone}
          className="rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {t.cancel}
        </button>
        <button
          disabled={isPending || !body.trim()}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await updateWorkComment(comment.id, workItemId, body);
              if ("error" in result) {
                setError(result.error);
                return;
              }
              router.refresh();
              onDone();
            });
          }}
          className="rounded-lg bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground disabled:opacity-60"
        >
          {t.save}
        </button>
      </div>
    </div>
  );
}

export function WorkCommentItem({
  comment,
  workItemId,
  authorName,
  currentUser,
  locale,
}: {
  comment: CommentWithReplies;
  workItemId: string;
  authorName: string;
  currentUser: CurrentUser;
  locale: Locale;
}) {
  const t = getDictionary(locale).work.detail;
  const [isReplying, setIsReplying] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);

  return (
    <div className="flex gap-3">
      <UserAvatar name={comment.authorName} />
      <div className="min-w-0 flex-1 space-y-2">
        {editingId === comment.id ? (
          <EditCommentForm
            workItemId={workItemId}
            comment={comment}
            locale={locale}
            onDone={() => setEditingId(null)}
          />
        ) : (
          <div className="rounded-2xl rounded-tl-sm bg-muted/60 px-3.5 py-2.5">
            <div className="mb-0.5 flex items-baseline gap-2">
              <span className="text-sm font-semibold">{comment.authorName}</span>
              <span className="text-[11px] text-muted-foreground">{formatShortDateTime(comment.createdAt, locale)}</span>
            </div>
            <p className="text-sm whitespace-pre-wrap text-foreground/90">{comment.body}</p>
          </div>
        )}

        <div className="ml-1 flex items-center gap-3">
          <button
            onClick={() => setIsReplying((v) => !v)}
            className="text-xs font-medium text-muted-foreground transition hover:text-foreground"
          >
            {t.reply}
          </button>
          {isOwnerOrAdmin(currentUser, comment.createdById) && editingId !== comment.id && (
            <CommentActions
              workItemId={workItemId}
              comment={comment}
              locale={locale}
              onEdit={() => setEditingId(comment.id)}
            />
          )}
        </div>

        {comment.replies.length > 0 && (
          <div className="space-y-2.5 border-l-2 border-border/70 pl-3">
            {comment.replies.map((reply) => (
              <div key={reply.id} className="flex gap-2.5">
                <UserAvatar name={reply.authorName} size="sm" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  {editingId === reply.id ? (
                    <EditCommentForm
                      workItemId={workItemId}
                      comment={reply}
                      locale={locale}
                      onDone={() => setEditingId(null)}
                    />
                  ) : (
                    <div className="rounded-2xl rounded-tl-sm bg-muted/40 px-3 py-2">
                      <div className="mb-0.5 flex items-baseline gap-2">
                        <span className="text-xs font-semibold">{reply.authorName}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatShortDateTime(reply.createdAt, locale)}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap text-foreground/90">{reply.body}</p>
                    </div>
                  )}
                  {isOwnerOrAdmin(currentUser, reply.createdById) && editingId !== reply.id && (
                    <div className="ml-1 flex items-center gap-3">
                      <CommentActions
                        workItemId={workItemId}
                        comment={reply}
                        locale={locale}
                        onEdit={() => setEditingId(reply.id)}
                      />
                    </div>
                  )}
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
