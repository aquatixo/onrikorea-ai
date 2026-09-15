import type { WorkStatus } from "@prisma/client";

export const WORK_STATUS_STYLE: Record<WorkStatus, string> = {
  TODO: "bg-muted text-muted-foreground",
  AWAITING_REPLY: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  IN_PROGRESS: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  DONE: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

export const WORK_STATUS_VALUES: WorkStatus[] = ["TODO", "AWAITING_REPLY", "IN_PROGRESS", "DONE"];

/** Curated label-color palette (hex) offered in the color picker -- imported data may carry any exact hex, not just these. */
export const WORK_COLOR_PALETTE: string[] = [
  "#ef4444", "#ec4899", "#a855f7", "#8b5cf6", "#6366f1", "#3b82f6", "#0ea5e9", "#06b6d4", "#14b8a6", "#10b981",
  "#22c55e", "#84cc16", "#eab308", "#f59e0b", "#f97316", "#78716c", "#71717a", "#64748b", "#a48bff", "#d946ef",
];
