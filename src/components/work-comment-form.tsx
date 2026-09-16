"use client";

import * as React from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { addWorkComment } from "@/app/work/actions";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";

export function WorkCommentForm({
  workItemId,
  parentId,
  authorName,
  locale,
  onPosted,
  compact,
}: {
  workItemId: string;
  parentId?: string;
  authorName: string;
  locale: Locale;
  onPosted?: () => void;
  compact?: boolean;
}) {
  const t = getDictionary(locale).work.detail;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [body, setBody] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await addWorkComment({ workItemId, parentId, body });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setBody("");
      router.refresh();
      onPosted?.();
    });
  }

  if (!authorName) {
    return <p className="text-sm text-muted-foreground">{t.nameRequired}</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3">
      {!compact && <UserAvatar name={authorName} />}
      <div className="min-w-0 flex-1 space-y-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={parentId ? t.replyPlaceholder : t.commentPlaceholder}
          rows={compact ? 2 : 3}
          className="w-full resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={isPending || !body.trim()}>
            {isPending ? t.posting : t.postComment}
          </Button>
        </div>
      </div>
    </form>
  );
}
