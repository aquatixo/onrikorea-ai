"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { UserAvatar } from "@/components/user-avatar";
import { updateBrandLog, deleteBrandLog } from "@/app/(dashboard)/brands/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { isOwnerOrAdmin } from "@/lib/auth/ownership";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";
import type { BrandLog } from "@prisma/client";
import { formatShortDateTime } from "@/lib/format-date";

type LogWithAuthor = BrandLog & { createdBy: { name: string } | null };
type CurrentUser = { id: string; role: "ADMIN" | "DEVELOPER" | "USER" } | null;

export function BrandLogItem({
  log,
  brandId,
  currentUser,
  locale,
}: {
  log: LogWithAuthor;
  brandId: string;
  currentUser: CurrentUser;
  locale: Locale;
}) {
  const t = getDictionary(locale).detail;
  const router = useRouter();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [isEditing, setIsEditing] = React.useState(false);
  const [body, setBody] = React.useState(log.body);
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const authorName = log.createdBy?.name ?? "—";
  const canModify = isOwnerOrAdmin(currentUser, log.createdById);

  if (isEditing) {
    return (
      <div className="flex gap-3">
        <UserAvatar name={authorName} size="sm" />
        <div className="min-w-0 flex-1 space-y-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setIsEditing(false);
                setBody(log.body);
                setError(null);
              }}
              className="rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {t.logCancel}
            </button>
            <button
              disabled={isPending || !body.trim()}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const result = await updateBrandLog(log.id, brandId, body);
                  if ("error" in result) {
                    setError(result.error);
                    return;
                  }
                  router.refresh();
                  setIsEditing(false);
                });
              }}
              className="rounded-lg bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground disabled:opacity-60"
            >
              {t.logSave}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      {confirmDialog}
      <UserAvatar name={authorName} size="sm" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="rounded-2xl rounded-tl-sm bg-muted/60 px-3.5 py-2.5">
          <div className="mb-0.5 flex items-baseline gap-2">
            <span className="text-sm font-semibold">{authorName}</span>
            <span className="text-[11px] text-muted-foreground">{formatShortDateTime(log.createdAt, locale)}</span>
          </div>
          <p className="text-sm whitespace-pre-wrap text-foreground/90">{log.body}</p>
        </div>
        {canModify && (
          <div className="ml-1 flex items-center gap-3">
            <button
              onClick={() => setIsEditing(true)}
              className="text-xs font-medium text-muted-foreground transition hover:text-foreground"
            >
              {t.edit}
            </button>
            <button
              disabled={isPending}
              onClick={async () => {
                if (!(await confirm({ description: t.confirmDeleteLog, destructive: true }))) return;
                startTransition(async () => {
                  const result = await deleteBrandLog(log.id, brandId);
                  if (result?.error) await confirm({ description: result.error, alertOnly: true });
                  router.refresh();
                });
              }}
              className="text-xs font-medium text-muted-foreground transition hover:text-destructive"
            >
              {t.delete}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
