"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createPerson } from "@/app/(dashboard)/settings/work-assignees/actions";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";

export function AddPersonForm({
  locale,
  availableUsers,
}: {
  locale: Locale;
  availableUsers: { id: string; name: string }[];
}) {
  const t = getDictionary(locale).settings.people;
  const router = useRouter();
  // Starts unselected on purpose -- defaulting to availableUsers[0] meant clicking
  // "추가" without touching the dropdown silently registered whoever happened to be
  // first in the list.
  const [userId, setUserId] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  if (availableUsers.length === 0) {
    return <p className="text-sm text-muted-foreground">{t.noAvailableUsers}</p>;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createPerson(userId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-start gap-2">
      <div className="flex-1 space-y-1">
        <select
          required
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="w-full min-w-[200px] rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30"
        >
          <option value="" disabled>
            {t.selectPlaceholder}
          </option>
          {availableUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
      <Button type="submit" disabled={isPending || !userId}>
        <Plus className="size-4" /> {t.addPerson}
      </Button>
    </form>
  );
}
