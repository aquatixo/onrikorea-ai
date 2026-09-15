"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateWorkStatus } from "@/app/work/actions";
import { WORK_STATUS_VALUES } from "@/lib/work-status";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";
import type { WorkStatus } from "@prisma/client";

export function WorkStatusControl({
  workItemId,
  status,
  locale,
}: {
  workItemId: string;
  status: WorkStatus;
  locale: Locale;
}) {
  const t = getDictionary(locale);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleChange(next: WorkStatus) {
    startTransition(async () => {
      await updateWorkStatus(workItemId, next);
      router.refresh();
    });
  }

  return (
    <select
      value={status}
      disabled={isPending}
      onChange={(e) => handleChange(e.target.value as WorkStatus)}
      className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium outline-none focus:ring-2 focus:ring-ring/50"
    >
      {WORK_STATUS_VALUES.map((s) => (
        <option key={s} value={s}>
          {t.work.status[s]}
        </option>
      ))}
    </select>
  );
}
