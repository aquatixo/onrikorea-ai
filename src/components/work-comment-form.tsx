"use client";

import * as React from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { addWorkComment } from "@/app/work/actions";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";

export function WorkCommentForm({
  workItemId,
  parentId,
  authorName,
  locale,
  onPosted,
}: {
  workItemId: string;
  parentId?: string;
  authorName: string;
  locale: Locale;
  onPosted?: () => void;
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
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={parentId ? t.replyPlaceholder : t.commentPlaceholder}
        rows={parentId ? 2 : 3}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? t.posting : t.postComment}
      </Button>
    </form>
  );
}
