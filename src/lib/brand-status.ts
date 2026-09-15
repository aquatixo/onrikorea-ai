import type { BrandStatus } from "@prisma/client";

export const STATUS_STYLE: Record<BrandStatus, string> = {
  NEW: "bg-muted text-muted-foreground",
  SCREENING: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  APPROVED: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  CONTACTED: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  REPLIED: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  REJECTED: "bg-destructive/10 text-destructive",
  ONBOARDED: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};
