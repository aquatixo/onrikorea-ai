"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "cn";
import { updateWorkStatus } from "@/app/(dashboard)/work/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { WORK_STATUS_STYLE, WORK_STATUS_VALUES } from "@/lib/work-status";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";
import type { WorkStatus } from "@prisma/client";

export function WorkStatusControl({
  workItemId,
  status,
  locale,
  canModify,
}: {
  workItemId: string;
  status: WorkStatus;
  locale: Locale;
  canModify: boolean;
}) {
  const t = getDictionary(locale);
  const router = useRouter();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [isPending, startTransition] = useTransition();

  function handleChange(next: WorkStatus) {
    startTransition(async () => {
      const result = await updateWorkStatus(workItemId, next);
      if (result.error) await confirm({ description: result.error, alertOnly: true });
      router.refresh();
    });
  }

  if (!canModify) {
    return (
      <span
        className={cn(
          "inline-block rounded-full py-1.5 pr-3.5 pl-3.5 text-xs font-semibold ring-1 ring-black/5 dark:ring-white/10",
          WORK_STATUS_STYLE[status]
        )}
      >
        {t.work.status[status]}
      </span>
    );
  }

  return (
    <>
      {confirmDialog}
      <div className="relative inline-block">
        <select
          value={status}
          disabled={isPending}
          onChange={(e) => handleChange(e.target.value as WorkStatus)}
          className={cn(
            "cursor-pointer appearance-none rounded-full border-0 py-1.5 pr-7 pl-3.5 text-xs font-semibold outline-none ring-1 ring-black/5 transition-opacity focus:ring-2 focus:ring-ring disabled:cursor-wait disabled:opacity-60 dark:ring-white/10",
            WORK_STATUS_STYLE[status]
          )}
        >
          {WORK_STATUS_VALUES.map((s) => (
            <option key={s} value={s} className="bg-popover text-foreground">
              {t.work.status[s]}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3 -translate-y-1/2 opacity-60" />
      </div>
    </>
  );
}
