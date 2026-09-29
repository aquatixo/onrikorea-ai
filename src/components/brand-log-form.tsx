"use client";

import * as React from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createBrandLog } from "@/app/(dashboard)/brands/actions";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";

export function BrandLogForm({ brandId, locale }: { brandId: string; locale: Locale }) {
  const t = getDictionary(locale).detail;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [body, setBody] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createBrandLog(brandId, body);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setBody("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t.logPlaceholder}
        rows={2}
        className="w-full resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={isPending || !body.trim()}>
          {isPending ? t.logPosting : t.logAdd}
        </Button>
      </div>
    </form>
  );
}
