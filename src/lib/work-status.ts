import type { WorkStatus } from "@prisma/client";

export const WORK_STATUS_STYLE: Record<WorkStatus, string> = {
  TODO: "bg-muted text-muted-foreground",
  IN_PROGRESS: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  DONE: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

export const WORK_STATUS_VALUES: WorkStatus[] = ["TODO", "IN_PROGRESS", "DONE"];
